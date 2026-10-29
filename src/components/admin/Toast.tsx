'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, error = false) => {
    setMsg({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), error ? 6000 : 3000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { msg, show };
}

export function Toast({ msg }: { msg: { text: string; error: boolean } | null; show?: unknown }) {
  if (!msg) return null;
  return <div className={`a-toast${msg.error ? ' a-toast--error' : ''}`} role={msg.error ? 'alert' : 'status'}>{msg.text}</div>;
}
