import { z } from "zod";

export const APP_ROLES = [
  "director",
  "project_manager",
  "sales",
  "purchase",
  "site_engineer",
  "accounts",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  director: "Managing Director",
  project_manager: "Project Manager",
  sales: "Sales Executive",
  purchase: "Purchase Officer",
  site_engineer: "Site Engineer",
  accounts: "Accounts & Billing",
};

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const UpdatePasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const CreateEmployeeSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  designation: z.string().optional().default("Staff"),
  phone: z.string().optional(),
  roles: z.array(z.enum(APP_ROLES)).min(1, "Select at least one role"),
});

export const UpdateEmployeeSchema = z.object({
  id: z.string().uuid("Invalid employee ID"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
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
