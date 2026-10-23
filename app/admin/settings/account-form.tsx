"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { updateDirectorAccountAction, resetDirectorMfaAction } from "@/lib/auth/actions";

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

/** Unpairs the phone, then the dashboard shows the setup screen to pair a new one. */
export function AuthenticatorReset() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setTyped("");
  }

  async function reset() {
    setPending(true);
    setError(null);
    const res = await resetDirectorMfaAction();
    if (res.error) {
      setError(res.error);
      setPending(false);
      close();
    } else {
      router.refresh();
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-5 max-w-xl space-y-3 text-xs">
      <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Google Authenticator</span>
      </div>
      <p className="text-slate-600">Your phone is paired. Reset it if you changed phones or removed the app.</p>
      {error && <div className="p-3 rounded-xl border bg-rose-50 border-rose-200 text-rose-700">{error}</div>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 rounded-xl border border-rose-200 bg-white/70 hover:bg-rose-50 text-rose-700 font-semibold flex items-center gap-2 cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Reset Google Authenticator</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Reset Google Authenticator?</h3>
              <button type="button" onClick={close} aria-label="Close" className="text-slate-500 hover:text-slate-900 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  This removes the paired phone. The dashboard locks until you scan a new QR code and enter a new
                  6-digit code.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-700">
                  Type <strong className="font-semibold">reset</strong> to confirm.
                </label>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={typed.trim().toLowerCase() !== "reset" || pending}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Reset Google Authenticator</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
