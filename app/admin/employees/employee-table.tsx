"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Check,
  X,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  APP_ROLES,
  ROLE_LABELS,
  AppRole,
  EmployeeProfile,
  ROLE_CHOICES,
  roleChoiceOf,
} from "@/lib/auth/types";
import {
  createEmployeeAction,
  updateEmployeeAction,
  deleteEmployeeAction,
} from "@/lib/auth/actions";

interface EmployeeTableProps {
  initialEmployees: EmployeeProfile[];
}

export function EmployeeTable({ initialEmployees }: EmployeeTableProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>(initialEmployees);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State for Add Employee
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("Staff");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(["site_engineer"]);

  // Form State for Edit Employee
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const resetAddForm = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setDesignation("Staff");
    setSelectedRoles(["site_engineer"]);
    setError(null);
  };

  const handleToggleRole = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await createEmployeeAction({
        fullName,
        email,
        password,
        phone: phone || undefined,
        designation: designation || undefined,
        roles: selectedRoles,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setIsAddOpen(false);
        resetAddForm();
        window.location.reload();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget || deleteConfirmText.trim() !== deleteTarget.fullName.trim()) return;

    setIsSubmitting(true);
    setDeleteError(null);
    try {
      const res = await deleteEmployeeAction(deleteTarget.id);
      if (res.error) {
        setDeleteError(res.error);
      } else {
        setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        setDeleteTarget(null);
        setDeleteConfirmText("");
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await updateEmployeeAction({
        id: editingEmployee.id,
        fullName: editingEmployee.fullName,
        email: editEmail || undefined,
        password: editPassword.trim() ? editPassword.trim() : undefined,
        phone: editingEmployee.phone || undefined,
        designation: editingEmployee.designation || undefined,
        roles: editingEmployee.roles,
        isActive: editingEmployee.isActive,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setEditingEmployee(null);
        window.location.reload();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <span>Employee Directory</span>
          </h1>
        </div>

        <button
          onClick={() => {
            resetAddForm();
            setIsAddOpen(true);
          }}
          className="fab inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-md shadow-blue-600/25 cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Directory Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Email &amp; Contact</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Assigned Roles</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No employee accounts found. Click &quot;Add Employee&quot; to create your first team member.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">
                        {emp.fullName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {emp.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {emp.email ? (
                          <span>
                            {emp.email.endsWith("@westeel.test") ? (
                              <>
                                <span className="font-semibold text-slate-100">{emp.email.replace("@westeel.test", "")}</span>
                                <span className="text-slate-500 text-[10px] block">{emp.email}</span>
                              </>
                            ) : (
                              <span>{emp.email}</span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {emp.phone || "No phone"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300">
                        {emp.designation || "Staff"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {emp.roles.filter((r) => !(r === "sales" && emp.roles.some((x) => x === "sales_lead" || x === "sales_field"))).map((r) => (
                          <span
                            key={r}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                              r === "director"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : r === "site_engineer"
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : r === "accounts"
                                ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {ROLE_LABELS[r]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          emp.isActive
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/60"
                            : "bg-rose-950/60 text-rose-400 border-rose-800/60"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            emp.isActive ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                        />
                        <span>{emp.isActive ? "Active" : "Inactive"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingEmployee({ ...emp });
                            setEditEmail(emp.email || "");
                            setEditPassword("");
                            setError(null);
                          }}
                          title="Edit Roles & Profile"
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget(emp);
                            setDeleteConfirmText("");
                            setDeleteError(null);
                          }}
                          disabled={isSubmitting}
                          title="Delete Employee"
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE EMPLOYEE MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Create New Employee Account</span>
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Sahoo"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Username or Email ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. sales3 or sales3@westeel.test"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Designation / Title
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Site Engineer"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-semibold text-slate-300 block">Role</label>
                <select
                  value={roleChoiceOf(selectedRoles)}
                  onChange={(e) => {
                    const c = ROLE_CHOICES.find((x) => x.value === e.target.value);
                    setSelectedRoles(c ? [...c.roles] : []);
                    if (c && (!designation || designation === "Staff")) setDesignation(c.label);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select role...</option>
                  {ROLE_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? "Creating..." : "Save Employee"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <span>Edit Employee: {editingEmployee.fullName}</span>
              </h2>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.fullName}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        fullName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Username or Email ID
                  </label>
                  <input
                    type="text"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="e.g. sales1 or sales1@westeel.test"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    New Password (Optional)
                  </label>
                  <input
                    type="password"
                    minLength={6}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editingEmployee.phone || ""}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Designation
                </label>
                <input
                  type="text"
                  value={editingEmployee.designation || ""}
                  onChange={(e) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      designation: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-semibold text-slate-300 block">Role</label>
                {editingEmployee.roles.includes("director") ? (
                  <div className="text-xs text-slate-300">{ROLE_LABELS.director}</div>
                ) : (
                  <select
                    value={roleChoiceOf(editingEmployee.roles)}
                    onChange={(e) => {
                      const c = ROLE_CHOICES.find((x) => x.value === e.target.value);
                      setEditingEmployee({ ...editingEmployee, roles: c ? [...c.roles] : [] });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Select role...</option>
                    {ROLE_CHOICES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? "Updating..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE EMPLOYEE CONFIRMATION MODAL (GITHUB STYLE) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-rose-900/40 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Delete Employee Account</span>
              </h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-200 text-xs space-y-2">
              <p className="font-semibold text-rose-300">
                This action cannot be undone.
              </p>
              <p className="text-slate-400 leading-relaxed">
                This will permanently delete the account of{" "}
                <span className="font-semibold text-slate-100">{deleteTarget.fullName}</span>,
                revoke their active sessions, and remove their system access.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] text-slate-300 block">
                  To confirm, type{" "}
                  <span className="font-mono font-semibold text-rose-300 select-all bg-slate-950 px-1.5 py-0.5 rounded border border-rose-900/60">
                    {deleteTarget.fullName}
                  </span>{" "}
                  below:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteTarget.fullName}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    deleteConfirmText.trim() !== deleteTarget.fullName.trim()
                  }
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 disabled:cursor-not-allowed text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? "Deleting..." : "Permanently Delete"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
