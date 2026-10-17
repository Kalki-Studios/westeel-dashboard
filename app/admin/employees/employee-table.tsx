"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Check,
  X,
  Edit2,
  UserX,
  UserCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  APP_ROLES,
  ROLE_LABELS,
  AppRole,
  EmployeeProfile,
} from "@/lib/auth/types";
import {
  createEmployeeAction,
  updateEmployeeAction,
  toggleEmployeeStatusAction,
} from "@/lib/auth/actions";

interface EmployeeTableProps {
  initialEmployees: EmployeeProfile[];
}

export function EmployeeTable({ initialEmployees }: EmployeeTableProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>(initialEmployees);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State for Add Employee
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("Staff");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(["site_engineer"]);

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

  const handleToggleStatus = async (emp: EmployeeProfile) => {
    const nextStatus = !emp.isActive;
    const confirmMsg = nextStatus
      ? `Reactivate account for ${emp.fullName}?`
      : `Deactivate account for ${emp.fullName}? They will be blocked from accessing the system immediately.`;

    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const res = await toggleEmployeeStatusAction(emp.id, nextStatus);
      if (res.error) {
        alert(`Error: ${res.error}`);
      } else {
        setEmployees((prev) =>
          prev.map((e) => (e.id === emp.id ? { ...e, isActive: nextStatus } : e))
        );
      }
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
          <p className="text-xs text-slate-400 mt-0.5">
            Manage staff accounts, assign operational roles, and enforce security controls.
          </p>
        </div>

        <button
          onClick={() => {
            resetAddForm();
            setIsAddOpen(true);
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow-sm cursor-pointer shrink-0"
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
                      <div>{emp.email || "—"}</div>
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
                        {emp.roles.map((r) => (
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
                          onClick={() => setEditingEmployee({ ...emp })}
                          title="Edit Roles & Profile"
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          title={emp.isActive ? "Deactivate User" : "Reactivate User"}
                          className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${
                            emp.isActive
                              ? "text-slate-400 hover:text-rose-400"
                              : "text-slate-400 hover:text-emerald-400"
                          }`}
                        >
                          {emp.isActive ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
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
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ramesh@westeel.in"
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

              {/* Roles Multi-Select Checkboxes */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Assigned Operational Roles (Union of permissions applies)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  {APP_ROLES.map((role) => {
                    const isChecked = selectedRoles.includes(role);
                    return (
                      <label
                        key={role}
                        className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition ${
                          isChecked
                            ? "bg-amber-500/10 border-amber-500/40 text-slate-100"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRole(role)}
                          className="sr-only"
                        />
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isChecked
                              ? "bg-amber-500 border-amber-500 text-slate-950"
                              : "border-slate-700"
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span className="font-medium">{ROLE_LABELS[role]}</span>
                      </label>
                    );
                  })}
                </div>
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
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
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

              {/* Roles Multi-Select Checkboxes */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  Assigned Operational Roles
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  {APP_ROLES.map((role) => {
                    const isChecked = editingEmployee.roles.includes(role);
                    return (
                      <label
                        key={role}
                        className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition ${
                          isChecked
                            ? "bg-amber-500/10 border-amber-500/40 text-slate-100"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newRoles = isChecked
                              ? editingEmployee.roles.filter((r) => r !== role)
                              : [...editingEmployee.roles, role];
                            setEditingEmployee({
                              ...editingEmployee,
                              roles: newRoles,
                            });
                          }}
                          className="sr-only"
                        />
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                            isChecked
                              ? "bg-amber-500 border-amber-500 text-slate-950"
                              : "border-slate-700"
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span className="font-medium">{ROLE_LABELS[role]}</span>
                      </label>
                    );
                  })}
                </div>
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
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? "Updating..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
