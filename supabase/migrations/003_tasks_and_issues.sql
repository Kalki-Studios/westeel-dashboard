-- Westeel Buildings: Migration 003 - Tasks and Issues
-- Enums: task_kind, task_priority, task_status
-- Tables: tasks, task_comments
-- Triggers: audit triggers on tasks, task_comments
-- Row Level Security (RLS) policies

-- 1. Create Enums
CREATE TYPE task_kind AS ENUM (
  'task',
  'issue'
);

CREATE TYPE task_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE task_status AS ENUM (
  'open',
  'in_progress',
  'blocked',
  'done'
);

-- 2. Create Tasks Table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE, -- nullable per spec (project optional)
  kind task_kind NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status task_status NOT NULL DEFAULT 'open',
  blocked_reason TEXT,
  resolution_note TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Task Comments Table
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Audit Triggers
CREATE TRIGGER audit_tasks_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_task_comments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- 6. Helper function to check if user can view a task
CREATE OR REPLACE FUNCTION public.can_view_task(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = t_id
      AND (
        public.is_director()
        OR t.assignee_id = auth.uid()
        OR t.created_by = auth.uid()
        OR (
          t.project_id IS NOT NULL
          AND public.has_role('project_manager')
          AND public.is_project_member(t.project_id)
        )
      )
  );
$$;

-- 7. RLS Policies for Tasks

-- SELECT:
-- Director can view all tasks.
-- Assignee or Creator can view own tasks.
-- Project Manager can view tasks in assigned projects.
CREATE POLICY "tasks_select"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.is_director()
      OR assignee_id = auth.uid()
      OR created_by = auth.uid()
      OR (
        project_id IS NOT NULL
        AND public.has_role('project_manager')
        AND public.is_project_member(project_id)
      )
    )
  );

-- INSERT:
-- Director can insert any task.
-- Project Manager can insert tasks for their assigned projects or general tasks.
-- Any active employee can raise an issue (kind = 'issue') on a project they belong to.
CREATE POLICY "tasks_insert"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      public.is_director()
      OR (
        public.has_role('project_manager')
        AND (project_id IS NULL OR public.is_project_member(project_id))
      )
      OR (
        kind = 'issue'
        AND project_id IS NOT NULL
        AND public.is_project_member(project_id)
      )
    )
  );

-- UPDATE:
-- Director can update all tasks.
-- Project Manager can update tasks in their assigned projects.
-- Assignee can update status, blocked_reason, resolution_note, completed_at on assigned task.
CREATE POLICY "tasks_update"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.is_director()
      OR (
        project_id IS NOT NULL
        AND public.has_role('project_manager')
        AND public.is_project_member(project_id)
      )
      OR assignee_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      public.is_director()
      OR (
        project_id IS NOT NULL
        AND public.has_role('project_manager')
        AND public.is_project_member(project_id)
      )
      OR assignee_id = auth.uid()
    )
  );

-- DELETE:
-- Director can delete any task.
-- Project Manager can delete tasks in their assigned projects.
CREATE POLICY "tasks_delete"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    public.is_active_user() AND (
      public.is_director()
      OR (
        project_id IS NOT NULL
        AND public.has_role('project_manager')
        AND public.is_project_member(project_id)
      )
    )
  );

-- 8. RLS Policies for Task Comments

-- SELECT:
-- Any user who can view the task can view its comments
CREATE POLICY "task_comments_select"
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND public.can_view_task(task_id)
  );

-- INSERT:
-- Any active user who can view the task can comment on it
CREATE POLICY "task_comments_insert"
  ON public.task_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND author_id = auth.uid()
    AND public.can_view_task(task_id)
  );

-- UPDATE / DELETE:
-- Author or Director can update/delete comments
CREATE POLICY "task_comments_update"
  ON public.task_comments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND (author_id = auth.uid() OR public.is_director())
  )
  WITH CHECK (
    public.is_active_user()
    AND (author_id = auth.uid() OR public.is_director())
  );

CREATE POLICY "task_comments_delete"
  ON public.task_comments
  FOR DELETE
  TO authenticated
  USING (
    public.is_active_user()
    AND (author_id = auth.uid() OR public.is_director())
  );
