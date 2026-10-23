"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSiteFlagAction } from "@/lib/auth/actions";

type Flag = "under_construction" | "mfa_off";

function Row({
  title,
  hint,
  on,
  busy,
  onToggle,
}: {
  title: string;
  hint: string;
  on: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="space-y-0.5">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-600">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={busy}
        onClick={onToggle}
        className={`relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-50 cursor-pointer ${
          on ? "bg-orange-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

export function DeveloperMode({
  underConstruction,
  mfaOffUntil,
}: {
  underConstruction: boolean;
  mfaOffUntil: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(flag: Flag, on: boolean) {
    setBusy(true);
    setError(null);
    const res = await setSiteFlagAction(flag, on);
    if (res.error) setError(res.error);
    else router.refresh();
    setBusy(false);
  }

  const until = mfaOffUntil
    ? new Date(mfaOffUntil).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div className="glass-panel rounded-2xl p-5 max-w-xl text-xs divide-y divide-white/60">
      {error && <div className="mb-4 p-3 rounded-xl border bg-rose-50 border-rose-200 text-rose-700">{error}</div>}
      <Row
        title="Turn off Google Authenticator"
        hint={
          until
            ? `Off until ${until}, then it switches back on by itself. Turn off the switch to restore it now.`
            : "Skips the 6-digit code while you develop. Switches back on by itself after 12 hours."
        }
        on={!!mfaOffUntil}
        busy={busy}
        onToggle={() => toggle("mfa_off", !mfaOffUntil)}
      />
      <Row
        title="Show site as under construction"
        hint="The landing page and the employee site show an under-construction page. The admin dashboard keeps working."
        on={underConstruction}
        busy={busy}
        onToggle={() => toggle("under_construction", !underConstruction)}
      />
    </div>
  );
}
