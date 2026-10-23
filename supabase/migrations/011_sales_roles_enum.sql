-- Two kinds of salesperson. Enum values must commit before they can be used (see 012).
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales_lead';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales_field';
