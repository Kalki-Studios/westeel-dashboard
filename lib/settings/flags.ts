import "server-only";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MFA_OFF_HOURS = 12;

/**
 * Developer switches. Defaults to "normal" (site open, 2FA on) when the table is missing or unreadable,
 * so a failure never weakens security. Dynamic: callers render per request.
 */
export async function getSiteFlags() {
  await connection();
  const { data } = await createAdminClient().from("site_flags").select("key, value");
  const f = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  const until = typeof f.mfa_off_until === "string" ? new Date(f.mfa_off_until) : null;
  return {
    underConstruction: f.under_construction === true,
    /** When 2FA is switched off it switches itself back on after this time. */
    mfaOffUntil: until && until.getTime() > Date.now() ? until.toISOString() : null,
  };
}

export async function setSiteFlag(flag: "under_construction" | "mfa_off", on: boolean) {
  const row =
    flag === "under_construction"
      ? { key: "under_construction", value: on }
      : { key: "mfa_off_until", value: on ? new Date(Date.now() + MFA_OFF_HOURS * 3600_000).toISOString() : null };
  const { error } = await createAdminClient()
    .from("site_flags")
    .upsert({ ...row, updated_at: new Date().toISOString() });
  return error?.message ?? null;
}
