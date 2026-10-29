// Client-safe formatting helpers.

const WIB = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' });

/** A UTC timestamp shown in Jakarta time, e.g. "21 Oct 2026, 14:05 WIB". */
export const formatWib = (iso: string | null | undefined) => (iso ? `${WIB.format(new Date(iso))} WIB` : '');
export const formatDay = (iso: string | null | undefined) => (iso ? DAY.format(new Date(iso)) : '');
