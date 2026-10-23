const IST = "Asia/Kolkata";

/** "24 Oct, 11:00 am" in IST. */
export const formatMeeting = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** "YYYY-MM-DD" of a timestamp in IST, comparable with getIstDateString(). */
export const istDateOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
