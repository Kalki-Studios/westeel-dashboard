"use client";

import { useState, useRef, useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  loginAction,
  loginWithMfaAction,
  resetDirectorMfaWithPasscodeAction,
} from "@/lib/auth/actions";

interface DirectorGateProps {
  hasActiveMfa?: boolean;
}

export function DirectorGate({ hasActiveMfa = false }: DirectorGateProps) {
  // Step 1: Predefined Email & Password login action (when MFA not setup)
  const [loginState, formAction, isPending] = useActionState(loginAction, null);

  // Step 3: Direct Google Authenticator login action (when MFA is active)
  const [mfaLoginState, mfaLoginFormAction, isMfaLoginPending] = useActionState(
    loginWithMfaAction,
    null
  );

  // Emergency reset for lost phone / re-pairing
  const [resetState, resetFormAction, isResetPending] = useActionState(
    resetDirectorMfaWithPasscodeAction,
    null
  );

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const mfaFormRef = useRef<HTMLFormElement>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCodeValue(sanitized);
    if (sanitized.length === 6 && mfaFormRef.current && !isMfaLoginPending) {
      mfaFormRef.current.requestSubmit();
    }
  };

  return (
    <div className="min-h-screen glass-canvas flex flex-col justify-center items-center p-6 text-slate-900 relative overflow-hidden">
      <div className="w-full max-w-md space-y-6 relative">
        {/* Logo and Brand Title */}
        <div className="text-center space-y-3">
          <div className="inline-block p-4 rounded-2xl glass">
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
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full chip-orange text-[10px] font-mono tracking-wider font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
              <span>DIRECTOR WORKSPACE GATE</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {hasActiveMfa ? "Two-Factor Authentication" : "Executive Authentication"}
            </h1>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              {hasActiveMfa
                ? "Enter the 6-digit verification code from your Google Authenticator app."
                : "High-security gateway for executive oversight, pipeline tracking, and financial controls."}
            </p>
          </div>
        </div>

        {/* =========================================================================
            STATE A: GOOGLE AUTHENTICATOR ONLY (When MFA is already set up)
            NOTE: He should NOT see the email and password box once MFA is configured!
            ========================================================================= */}
        {hasActiveMfa ? (
          <div className="space-y-4">
            <form
              ref={mfaFormRef}
              action={mfaLoginFormAction}
              className="p-7 rounded-3xl glass space-y-5"
            >
              {mfaLoginState?.error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{mfaLoginState.error}</span>
                </div>
              )}

              <div className="space-y-2 text-center">
                <label
                  htmlFor="mfa-direct-code"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700 block font-mono"
                >
                  Google Authenticator Code
                </label>
                <div className="relative">
                  <input
                    id="mfa-direct-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    autoFocus
                    value={codeValue}
                    onChange={handleCodeChange}
                    placeholder="000000"
                    disabled={isMfaLoginPending}
                    className="w-full text-center text-3xl font-mono tracking-[0.4em] py-3.5 px-4 rounded-xl glass-input border text-slate-900 placeholder:text-slate-300 focus:border-orange-500 focus:outline-none transition-colors"
                  />
                  <Smartphone className="w-4 h-4 text-slate-400 absolute right-4 top-4.5" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Open Google Authenticator on your phone and enter the active 6-digit code.
                </p>
              </div>

              <button
                type="submit"
                disabled={isMfaLoginPending || codeValue.length !== 6}
                className="w-full py-3.5 px-5 rounded-xl btn-spatial-orange text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isMfaLoginPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code & Enter Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Emergency Option: Lost phone / Unpair Authenticator */}
            <div className="text-center">
              {!showResetDialog ? (
                <button
                  type="button"
                  onClick={() => setShowResetDialog(true)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition flex items-center gap-1 mx-auto"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Lost access to Google Authenticator?</span>
                </button>
              ) : (
                <form
                  action={resetFormAction}
                  className="p-4 rounded-2xl glass text-left space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Unpair Google Authenticator
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowResetDialog(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Enter the director recovery code to remove your paired phone and return to password login:
                  </p>
                  {resetState?.error && (
                    <div className="text-rose-600 text-[11px] bg-rose-50 p-2 rounded border border-rose-200">
                      {resetState.error}
                    </div>
                  )}
                  <input
                    name="passcode"
                    type="password"
                    required
                    placeholder="Enter Recovery Code"
                    className="w-full px-3 py-2 rounded-lg glass-input border text-xs focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isResetPending}
                    className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isResetPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Unpair Phone & Reset to Password</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* =========================================================================
              STATE B: STEP 1 - PREDEFINED EMAIL & PASSWORD LOGIN (When MFA NOT setup)
              ========================================================================= */
          <form
            action={formAction}
            className="p-7 rounded-3xl glass space-y-5"
          >
            {loginState?.error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{loginState.error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 block font-mono"
              >
                Director Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="Email"
                  className="w-full px-4 py-3 rounded-xl glass-input border text-slate-900 placeholder:text-slate-400 text-sm focus:border-blue-600 focus:outline-none"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 block font-mono"
              >
                Director Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  className="w-full pl-4 pr-11 py-3 rounded-xl glass-input border text-slate-900 placeholder:text-slate-400 text-sm focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-700 hover:text-orange-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={2.25} /> : <Eye className="w-5 h-5" strokeWidth={2.25} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3.5 px-5 rounded-xl btn-spatial-orange text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span>{isPending ? "Checking Credentials..." : "Unlock Director Portal"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Back Link to Hub */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-orange-600 transition font-mono"
          >
            ← Return to Portal Hub
          </Link>
        </div>
      </div>
    </div>
  );
}
