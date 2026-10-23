"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { updateDirectorAccountAction } from "@/lib/auth/actions";

const input =
  "w-full px-3 py-2.5 rounded-xl glass-input border text-sm text-slate-900 focus:outline-none focus:border-orange-500";

export function AccountForm({ fullName, email }: { fullName: string; email: string }) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setMsg(null);
    const res = await updateDirectorAccountAction(null, new FormData(form));
    if (res.error) setMsg({ ok: false, text: res.error });
    else {
      setMsg({ ok: true, text: "Saved. Use the new email or password the next time you sign in." });
      form.reset();
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="glass-panel rounded-2xl p-5 max-w-xl space-y-4 text-xs">
      {msg && (
        <div
          className={`p-3 rounded-xl border ${
            msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Name</label>
          <input name="fullName" required defaultValue={fullName} className={input} />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Login email</label>
          <input name="email" type="email" required defaultValue={email} className={input} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">New password</label>
          <input name="newPassword" type="password" autoComplete="new-password" placeholder="Leave blank to keep" className={input} />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-slate-700">Confirm new password</label>
          <input name="confirmPassword" type="password" autoComplete="new-password" className={input} />
        </div>
      </div>

      <div className="space-y-1 pt-3 border-t border-white/60">
        <label className="font-semibold text-slate-700">Current password *</label>
        <input name="currentPassword" type="password" required autoComplete="current-password" className={input} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-spatial-orange px-5 py-2.5 text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        <span>Save changes</span>
      </button>
    </form>
  );
}
