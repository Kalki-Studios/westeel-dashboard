import { z } from "zod";

export const APP_ROLES = [
  "director",
  "project_manager",
  "sales",
  "sales_lead",
  "sales_field",
  "purchase",
  "site_engineer",
  "accounts",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  director: "Managing Director",
  project_manager: "Project Manager",
  sales: "Sales Executive",
  sales_lead: "Sales: Lead Generation & Meetings",
  sales_field: "Sales: Field Visits & Closing",
  purchase: "Purchase Officer",
  site_engineer: "Site Engineer",
  accounts: "Accounts & Billing",
};

/**
 * One dropdown choice per job. The two sales types also carry the umbrella "sales" role,
 * so every general sales rule applies and the lead/field roles only narrow it.
 */
export const ROLE_CHOICES: { value: string; label: string; roles: AppRole[] }[] = [
  { value: "project_manager", label: ROLE_LABELS.project_manager, roles: ["project_manager"] },
  { value: "sales_lead", label: ROLE_LABELS.sales_lead, roles: ["sales", "sales_lead"] },
  { value: "sales_field", label: ROLE_LABELS.sales_field, roles: ["sales", "sales_field"] },
  { value: "purchase", label: ROLE_LABELS.purchase, roles: ["purchase"] },
  { value: "site_engineer", label: ROLE_LABELS.site_engineer, roles: ["site_engineer"] },
  { value: "accounts", label: ROLE_LABELS.accounts, roles: ["accounts"] },
];

export const roleChoiceOf = (roles: AppRole[]) =>
  ROLE_CHOICES.find((c) => c.roles.every((r) => roles.includes(r)))?.value ?? "";

export const UpdateDirectorAccountSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name is required"),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters").optional().or(z.literal("")),
    confirmPassword: z.string().optional(),
  })
  .refine((d) => !d.newPassword || d.newPassword === d.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

export const LoginSchema = z.object({
  email: z.string().min(1, "Username or email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const UpdatePasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const CreateEmployeeSchema = z.object({
  email: z.string().min(1, "Username or email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  designation: z.string().optional().default("Staff"),
  phone: z.string().optional(),
  roles: z.array(z.enum(APP_ROLES)).min(1, "Select at least one role"),
});

export const UpdateEmployeeSchema = z.object({
  id: z.string().uuid("Invalid employee ID"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  designation: z.string().optional(),
  phone: z.string().optional(),
  roles: z.array(z.enum(APP_ROLES)).min(1, "Select at least one role"),
  isActive: z.boolean(),
});

export interface EmployeeProfile {
  id: string;
  email?: string;
  fullName: string;
  phone: string | null;
  designation: string | null;
  isActive: boolean;
  roles: AppRole[];
  createdAt: string;
  updatedAt: string;
}
