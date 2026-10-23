"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Lock, User, AlertCircle, ArrowRight, Briefcase, Loader2 } from "lucide-react";
import { employeeLoginAction } from "@/lib/auth/employee-actions";
import { useSearchParams } from "next/navigation";

export function EmployeeLoginGate({ initialError }: { initialError?: string }) {
  const [state, formAction, isPending] = useActionState(employeeLoginAction, null);
  const searchParams = useSearchParams();
  const isDeactivated = searchParams.get("deactivated") === "1";

  const errorMessage =
    state?.error ||
    initialError ||
    (isDeactivated ? "Your employee account has been deactivated. Contact the director." : null);

  return (
    <div className="min-h-screen spatial-canvas flex flex-col justify-center items-center p-6 text-slate-900 relative overflow-hidden">
      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-block p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <Image
              src="/westeel-logo-cropped.png"
              alt="Westeel Buildings Logo"
              width={160}
              height={60}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
          <div className="space-y-1 pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full chip-blue text-[10px] font-semibold tracking-wider">
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              <span>OPERATIONS WORKSPACE</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Employee Hub
            </h1>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              Sign in with your employee username or email and password to access field reports and tools.
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form
          action={formAction}
          className="p-7 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm"
        >
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 block"
            >
              Username or Email
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                required
                placeholder="e.g. sales1 or sales1@westeel.test"
                autoFocus
                className="w-full pl-4 pr-10 py-3 rounded-xl spatial-input text-sm text-slate-900 placeholder:text-slate-400"
              />
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-slate-700 block"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                className="w-full pl-4 pr-10 py-3 rounded-xl spatial-input text-sm text-slate-900 placeholder:text-slate-400"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-5 btn-spatial-orange text-xs flex items-center justify-center gap-2 cursor-pointer font-bold disabled:opacity-50 mt-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
