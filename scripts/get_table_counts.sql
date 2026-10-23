SELECT 'app_settings' AS table_name, count(*) AS row_count FROM public.app_settings
UNION ALL SELECT 'audit_log', count(*) FROM public.audit_log
UNION ALL SELECT 'documents', count(*) FROM public.documents
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'project_members', count(*) FROM public.project_members
UNION ALL SELECT 'project_milestones', count(*) FROM public.project_milestones
UNION ALL SELECT 'project_stages', count(*) FROM public.project_stages
UNION ALL SELECT 'projects', count(*) FROM public.projects
UNION ALL SELECT 'site_reports', count(*) FROM public.site_reports
UNION ALL SELECT 'task_comments', count(*) FROM public.task_comments
UNION ALL SELECT 'tasks', count(*) FROM public.tasks
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
ORDER BY table_name;
