"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Building, Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";
import { loginAction } from "@/lib/auth/actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <Building className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Westeel Buildings
          </h1>
          <p className="text-xs text-slate-400">
            Internal Operations &amp; Management Dashboard
          </p>
        </div>

        <form
          action={formAction}
          className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-4 shadow-xl"
        >
          {state?.error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-slate-300 block"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="name@westeel.in"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-slate-300 block"
              >
                Password
              </label>
              <Link
                href="/reset-password"
                className="text-[11px] text-amber-400 hover:text-amber-300 transition"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer mt-2"
          >
            <span>{isPending ? "Signing In..." : "Sign In to Workspace"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-400 transition font-mono"
          >
            ← Westeel Control Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
