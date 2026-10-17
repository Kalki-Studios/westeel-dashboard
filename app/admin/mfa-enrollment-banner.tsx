"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, ShieldCheck, QrCode, Loader2, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function MfaEnrollmentBanner() {
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
    const supabase = createClient();

    try {
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
      setTimeout(() => {
        setIsOpen(false);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (hasMfa === null || hasMfa === true) {
    return null; // Already enrolled or checking
  }

  return (
    <>
      <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <strong>Director Security Requirement:</strong> Two-Factor Authentication (TOTP) is required for director accounts.
          </span>
        </div>
        <button
          onClick={startEnrollment}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] transition shrink-0 cursor-pointer flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
          <span>Setup TOTP MFA</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Configure Two-Factor Authenticator</span>
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  MFA Successfully Configured
                </div>
                <div className="text-xs text-slate-400">
                  Your director account is now protected with TOTP two-factor authentication.
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <p className="text-xs text-slate-300">
                  Scan the QR code with Google Authenticator or any TOTP app, then enter the 6-digit verification code.
                </p>

                {qrCode && (
                  <div className="p-3 bg-white rounded-lg w-fit mx-auto shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="TOTP QR Code" className="w-40 h-40" />
                  </div>
                )}

                {secret && (
                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">
                      Manual Secret Key
                    </span>
                    <code className="text-xs text-amber-300 font-mono select-all bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      {secret}
                    </code>
                  </div>
                )}

                {error && (
                  <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded px-3 py-2">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300 block">
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
                    className="w-full text-center tracking-widest text-base font-mono py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || verifyCode.length !== 6}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition cursor-pointer"
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
