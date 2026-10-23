"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ShieldCheck, QrCode, Loader2, X, Check, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resetDirectorMfaAction } from "@/lib/auth/actions";

export function MfaEnrollmentBanner() {
  const router = useRouter();
  const [hasMfa, setHasMfa] = useState<boolean | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function checkMfa() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) {
        const verifiedTotp = data.totp.some((f) => f.status === "verified");
        setHasMfa(verifiedTotp);
      } else {
        setHasMfa(false);
      }
    }
    checkMfa();
  }, []);

  const startEnrollment = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setVerifyCode("");
    const supabase = createClient();

    try {
      // A half-finished earlier attempt blocks a new enroll (name conflict), so clear it first.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Westeel Buildings",
      });

      if (enrollError || !data) {
        throw new Error(enrollError?.message || "MFA enrollment failed");
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);

      // Create challenge
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: data.id });

      if (challengeError || !challengeData) {
        throw new Error(challengeError?.message || "MFA challenge generation failed");
      }

      setChallengeId(challengeData.id);
      setIsOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Enrollment error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: verifyCode.trim(),
      });

      if (verifyErr) {
        throw new Error(verifyErr.message);
      }

      setSuccess(true);
      setHasMfa(true);
      router.refresh();
      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetMfa = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await resetDirectorMfaAction();
      if (res && "error" in res && res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setHasMfa(false);
      setLoading(false);
      router.refresh();
      // Immediately launch the enrollment modal to setup Google Authenticator again
      await startEnrollment();
    } catch (err) {
      alert("Error resetting MFA: " + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  };

  if (hasMfa === null) {
    return null;
  }

  return (
    <>
      {hasMfa === true ? null : (
        <div className="glass-card-orange p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0">
              <ShieldAlert className="w-4 h-4 shrink-0" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-xs block sm:inline">
                Director Security Requirement:
              </span>{" "}
              <span className="text-slate-600">
                Two-Factor Authentication (TOTP) is required for director accounts.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={startEnrollment}
            disabled={loading}
            className="btn-spatial-orange px-4 py-2 text-xs transition shrink-0 cursor-pointer flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
            <span>Setup TOTP MFA</span>
          </button>
        </div>
      )}

      {!isOpen && error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <span>Configure Two-Factor Authenticator</span>
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  MFA Successfully Configured
                </div>
                <div className="text-xs text-slate-500">
                  Your director account is now protected with TOTP two-factor authentication.
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Scan the QR code with Google Authenticator or any TOTP app, then enter the 6-digit verification code.
                </p>

                {qrCode && (
                  <div className="p-3 bg-white rounded-lg w-fit mx-auto shadow-sm border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="TOTP QR Code" className="w-40 h-40" />
                  </div>
                )}

                {secret && (
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">
                      Manual Secret Key
                    </span>
                    <code className="text-xs text-orange-700 font-mono select-all bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      {secret}
                    </code>
                  </div>
                )}

                {error && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="123456"
                    className="w-full text-center tracking-widest text-base font-mono py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || verifyCode.length !== 6}
                    className="btn-spatial-orange px-4 py-2 disabled:opacity-50 text-xs transition cursor-pointer"
                  >
                    {loading ? "Verifying..." : "Verify & Enable"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
