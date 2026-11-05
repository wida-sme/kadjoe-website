// Client-safe formatting helpers.

const WIB = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' });

/** A UTC timestamp shown in Jakarta time, e.g. "21 Oct 2026, 14:05 WIB". */
export const formatWib = (iso: string | null | undefined) => (iso ? `${WIB.format(new Date(iso))} WIB` : '');
export const formatDay = (iso: string | null | undefined) => (iso ? DAY.format(new Date(iso)) : '');

/** An address line for display: "Blok C8 No.2" (block and house number) never breaks apart. */
const NBSP = String.fromCharCode(0xa0);
export const addressLine = (line: string) =>
  line
    .replace(/\b(Blok)\s+/gi, `$1${NBSP}`)
    .replace(/\s+(No\.)(\s*)(?=\d)/gi, (_m, no: string, gap: string) => `${NBSP}${no}${gap ? NBSP : ''}`);
