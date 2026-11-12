"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/app/_ui/kit";

type Sms = { id: string; text: string; at: string | null };
type Contact = { phone: string; name: string };
const OUR_CODE = "*347*13#";

// Feature-phone multi-tap for USSD replies: press a key again within TAP_MS to cycle its letters.
// # switches 123 -> abc -> ABC, like the shift on a button phone.
type Mode = "123" | "abc" | "ABC";
const NEXT_MODE: Record<Mode, Mode> = { "123": "abc", abc: "ABC", ABC: "123" };
const TAP_MS = 900;
const MULTI_TAP: Record<string, string> = {
  "1": ".,-?!1", "2": "abc2", "3": "def3", "4": "ghi4", "5": "jkl5", "6": "mno6", "7": "pqrs7", "8": "tuv8", "9": "wxyz9", "0": " 0",
};

export function Phone() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [phone, setPhone] = useState("");
  const [inbox, setInbox] = useState<Sms[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [screen, setScreen] = useState<"inbox" | "dial" | "ussd">("inbox");
  const [dial, setDial] = useState(OUR_CODE);
  const [ussd, setUssd] = useState<{ text: string; open: boolean; session: string; trail: string[] } | null>(null);
  const [reply, setReply] = useState("");
  const [mode, setMode] = useState<Mode>("123");
  const tap = useRef<{ key: string; at: number; index: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/sim/phones").then(async (r) => {
      const list = (await r.json()) as Contact[];
      setContacts(list);
      const fromUrl = new URLSearchParams(window.location.search).get("phone");
      setPhone((p) => p || fromUrl || list[0]?.phone || "");
    });
  }, []);

  const load = useCallback(async () => {
    if (!phone) return;
    const r = await fetch(`/api/sim/inbox?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
    const list = (await r.json()) as Sms[];
    setInbox((old) => {
      if (old.length && list[0] && list[0].id !== old[0]?.id) setFresh(list[0].id);
      return list;
    });
  }, [phone]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 1500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const send = async (trail: string[], session: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/ussd", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: session, phoneNumber: phone, text: trail.join("*"), serviceCode: OUR_CODE }) });
      const text = await r.text();
      setUssd({ text: text.replace(/^(CON|END) /, ""), open: text.startsWith("CON"), session, trail });
      setMode("123");
      tap.current = null;
      setScreen("ussd");
    } finally {
      setBusy(false);
    }
  };

  const call = async () => {
    const code = dial.trim();
    if (code === OUR_CODE) return send([], `sim-${Date.now()}`);
    if (code.startsWith("*7272*")) {
      setBusy(true);
      const r = await fetch("/api/sim/bank-ussd", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code }) });
      setUssd({ text: (await r.text()).replace(/^END /, ""), open: false, session: "", trail: [] });
      setScreen("ussd");
      setBusy(false);
      return;
    }
    setUssd({ text: "Unknown service code.", open: false, session: "", trail: [] });
    setScreen("ussd");
  };

  const typeKey = (k: string) => {
    if (k === "#") {
      setMode((m) => NEXT_MODE[m]);
      tap.current = null;
      return;
    }
    const letters = MULTI_TAP[k];
    if (mode === "123" || !letters) {
      tap.current = null;
      setReply((r) => r + k);
      return;
    }
    const chars = mode === "ABC" ? letters.toUpperCase() : letters;
    const now = Date.now();
    const last = tap.current;
    if (last && last.key === k && now - last.at < TAP_MS) {
      const index = (last.index + 1) % chars.length;
      tap.current = { key: k, at: now, index };
      setReply((r) => r.slice(0, -1) + chars[index]);
    } else {
      tap.current = { key: k, at: now, index: 0 };
      setReply((r) => r + chars[0]);
    }
  };

  const editingReply = screen === "ussd" && !!ussd?.open && reply.length > 0;
  const name = useMemo(() => contacts.find((c) => c.phone === phone)?.name ?? "New number", [contacts, phone]);
  const keys: [string, string][] = [
    ["1", ""], ["2", "abc"], ["3", "def"], ["4", "ghi"], ["5", "jkl"], ["6", "mno"], ["7", "pqrs"], ["8", "tuv"], ["9", "wxyz"], ["*", ""], ["0", "+"], ["#", ""],
  ];

  return (
    <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="max-w-md lg:pt-6">
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">Phone simulator</h1>
        <label className="mt-8 flex flex-col gap-1.5">
          <span className="text-sm font-semibold">SIM card</span>
          <span className="relative">
            <select value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-12 w-full appearance-none rounded-xl border border-line-2 bg-paper px-4 pr-10 text-base outline-none focus:border-forest focus:ring-4 focus:ring-forest/10">
              {phone && !contacts.some((c) => c.phone === phone) ? <option value={phone}>New number, {phone}</option> : null}
              {contacts.map((c) => (
                <option key={c.phone} value={c.phone}>
                  {c.name}, {c.phone}
                </option>
              ))}
            </select>
            <Icon name="chevronRight" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-ink-3" />
          </span>
        </label>
        <ol className="mt-8 flex flex-col gap-4 border-t border-line pt-6 text-[15px] text-ink-2">
          {[
            ["Pay a levy", <>Dial <b className="font-mono text-ink">{OUR_CODE}</b>, press Call, then reply <b className="text-ink">1</b>.</>],
            ["Confirm the amount", <>Reply <b className="text-ink">1</b> again. In the sandbox the bank approves at once.</>],
            ["Get the receipt", <>The SMS lands in the inbox, usually within seconds.</>],
          ].map(([title, body], i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest font-mono text-[12px] font-semibold text-lime">{i + 1}</span>
              <span>
                <span className="block font-semibold text-ink">{title}</span>
                {body}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 border-t border-line pt-5 text-[14px] text-ink-2">
          <span className="font-semibold text-ink">Typing letters.</span> When a menu asks for text, press <b className="font-mono text-ink">#</b> to switch between 123, abc and ABC, then tap a key again to move to its next letter. For an officer check, the number alone works: <b className="font-mono text-ink">001</b> for OTT-001.
        </p>
      </div>

      <div className="mx-auto w-[300px] rounded-[44px] bg-gradient-to-b from-[#26302b] to-[#141a17] p-[14px] shadow-[0_40px_80px_-30px_rgb(7_23_16/0.6),inset_0_1px_0_rgb(255_255_255/0.08)]">
        <div className="mx-auto mb-3 mt-1 h-1.5 w-14 rounded-full bg-black/40" aria-hidden="true" />
        <div className="rounded-[20px] bg-black/30 p-2.5">
          <div className="flex h-[360px] flex-col overflow-hidden rounded-xl bg-[#c5d4b4] font-mono text-[13px] leading-snug text-[#1d2a16] shadow-[inset_0_2px_8px_rgb(0_0_0/0.18)]">
            <div className="flex justify-between border-b border-[#1d2a16]/15 px-3 py-1.5 text-[10.5px]">
              <span>{name.split(" ")[0]}, MTN NG</span>
              <span>▮▮▮ 92%</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {screen === "inbox" && (
                <div className="flex flex-col gap-2">
                  <p className="font-bold">Messages ({inbox.length})</p>
                  {inbox.length === 0 && <p className="opacity-70">No messages yet.</p>}
                  {inbox.map((m) => (
                    <div key={m.id} className={`rounded-md bg-white/45 p-2 ${m.id === fresh ? "animate-pop ring-2 ring-[#1d2a16]" : ""}`}>
                      <p className="text-[10px] font-bold opacity-70">LevyPass {m.at ? new Date(m.at).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos" }) : ""}</p>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                  ))}
                </div>
              )}
              {screen === "dial" && (
                <div className="flex h-full flex-col justify-between">
                  <p className="text-[12px] opacity-70">Dial a code. LevyPass is {OUR_CODE}.</p>
                  <p className="break-all text-center text-[26px] font-bold">{dial || " "}</p>
                </div>
              )}
              {screen === "ussd" && ussd && (
                <div className="flex h-full flex-col gap-2">
                  <p className="whitespace-pre-wrap">{ussd.text}</p>
                  {ussd.open && (
                    <form
                      className="mt-auto flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void send([...ussd.trail, reply], ussd.session);
                        setReply("");
                      }}
                    >
                      <span className="relative min-w-0 flex-1">
                        <input autoFocus value={reply} onChange={(e) => setReply(e.target.value)} className="w-full rounded border border-[#1d2a16]/40 bg-white/60 py-1 pl-2 pr-9 outline-none focus:border-[#1d2a16] focus:ring-2 focus:ring-[#1d2a16]/40" aria-label="USSD reply" />
                        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm bg-[#1d2a16] px-1 text-[9px] font-bold leading-[14px] text-[#c5d4b4]" aria-live="polite" title="Press # to switch">
                          {mode}
                        </span>
                      </span>
                      <button disabled={busy} className="rounded bg-[#1d2a16] px-3 py-1 text-[#c5d4b4]">
                        Send
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 px-1">
          <button onClick={() => setScreen("inbox")} className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/10 text-[12px] font-semibold text-white hover:bg-white/15">
            <Icon name="message" size={14} />
            Inbox
          </button>
          <button onClick={() => (screen === "dial" ? void call() : setScreen("dial"))} disabled={busy} className="flex h-10 items-center justify-center rounded-full bg-lime text-[12px] font-bold text-forest hover:bg-lime-2 disabled:opacity-60">
            {screen === "dial" ? "Call" : "Dial"}
          </button>
          <button
            onClick={() => {
              if (screen === "dial") setDial((d) => d.slice(0, -1));
              else if (editingReply) {
                tap.current = null;
                setReply((r) => r.slice(0, -1));
              } else setScreen("inbox");
            }}
            className="flex h-10 items-center justify-center rounded-full bg-[#b3261e] text-[12px] font-semibold text-white hover:bg-[#9c2115]">
            {screen === "dial" || editingReply ? "Del" : "End"}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 px-1 pb-2">
          {keys.map(([k, letters]) => (
            <button
              key={k}
              onClick={() => {
                if (screen === "ussd" && ussd?.open) typeKey(k);
                else {
                  if (screen !== "dial") setDial("");
                  setScreen("dial");
                  setDial((d) => d + k);
                }
              }}
              className="flex h-12 flex-col items-center justify-center rounded-2xl bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition hover:bg-white/10 active:bg-white/20"
            >
              <span className="text-[19px] font-semibold leading-none">{k}</span>
              {(() => {
                const label = k === "#" && screen === "ussd" && ussd?.open ? "mode" : letters;
                return label ? <span className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/45">{label}</span> : null;
              })()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
