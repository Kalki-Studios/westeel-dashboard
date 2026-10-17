-- Westeel Buildings: Migration 001 - Database Foundation
-- Tables: profiles, user_roles, app_settings, audit_log
-- Enums: app_role
-- Helper Functions: is_director(), has_role(app_role), generic audit trigger
-- Row Level Security (RLS) policies

-- 1. Create Enums
CREATE TYPE app_role AS ENUM (
  'director',
  'project_manager',
  'sales',
  'purchase',
  'site_engineer',
  'accounts'
);

-- 2. Create Profiles Table (links 1-to-1 with auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  designation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create User Roles Table (A user may hold multiple roles)
CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- 4. Create App Settings Table
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create Audit Log Table (Append-only, Director read-only)
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Helper Functions (Security Definer)

-- Check if current authenticated user is an active director
CREATE OR REPLACE FUNCTION public.is_director()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'director'
      AND p.is_active = true
  );
$$;

-- Check if current authenticated user has an active specified role
CREATE OR REPLACE FUNCTION public.has_role(role_to_check app_role)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = role_to_check
      AND p.is_active = true
  );
$$;

-- Check if current authenticated user is an active user
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
  );
$$;

-- 7. Generic Audit Trigger Function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  rec_id UUID;
  old_json JSONB := NULL;
  new_json JSONB := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    rec_id := OLD.id;
    old_json := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    rec_id := NEW.id;
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
  ELSIF TG_OP = 'INSERT' THEN
    rec_id := NEW.id;
    new_json := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    changed_by,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    TG_TABLE_NAME,
    rec_id,
    TG_OP,
    auth.uid(),
    old_json,
    new_json,
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8. Auto-create Profile Trigger on New Auth User
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, designation, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'designation', 'Staff'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Attach audit trigger to core tables
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_app_settings_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies

-- PROFILES
-- Active users can read active profiles; directors can read all profiles
CREATE POLICY "profiles_read_active"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    (public.is_active_user() AND is_active = true)
    OR public.is_director()
    OR id = auth.uid()
  );

-- Director can insert/update any profile
CREATE POLICY "profiles_director_insert"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_director());

CREATE POLICY "profiles_director_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- Users can update their own phone or full_name if active
CREATE POLICY "profiles_self_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND public.is_active_user())
  WITH CHECK (id = auth.uid() AND public.is_active_user());

-- USER ROLES
-- Active users can read their own roles; director can read all roles
CREATE POLICY "user_roles_read"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_active_user())
    OR public.is_director()
  );

-- Only director can modify roles
CREATE POLICY "user_roles_director_insert"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_director());

CREATE POLICY "user_roles_director_update"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

CREATE POLICY "user_roles_director_delete"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_director());

-- APP SETTINGS
-- Any active authenticated user can read app settings
CREATE POLICY "app_settings_read_active"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- Only director can write app settings
CREATE POLICY "app_settings_director_write"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (public.is_director())
  WITH CHECK (public.is_director());

-- AUDIT LOG
-- Director only can read audit log
CREATE POLICY "audit_log_director_read"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_director());

-- Append-only enforcement: Nobody can UPDATE or DELETE audit_log records
-- (No UPDATE or DELETE policies are granted, which causes Postgres RLS to deny all update/delete)
