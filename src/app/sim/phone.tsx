"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Sms = { id: string; text: string; at: string | null };
type Contact = { phone: string; name: string };
const OUR_CODE = "*347*13#";

export function Phone() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [phone, setPhone] = useState("");
  const [inbox, setInbox] = useState<Sms[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [screen, setScreen] = useState<"inbox" | "dial" | "ussd">("inbox");
  const [dial, setDial] = useState(OUR_CODE);
  const [ussd, setUssd] = useState<{ text: string; open: boolean; session: string; trail: string[] } | null>(null);
  const [reply, setReply] = useState("");
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

  const name = useMemo(() => contacts.find((c) => c.phone === phone)?.name ?? "New number", [contacts, phone]);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

  return (
    <div className="flex flex-col items-center gap-4">
      <label className="flex w-80 flex-col gap-1 text-sm font-semibold text-slate-300">
        SIM card (trader phone)
        <select value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg bg-slate-800 px-3 py-2 text-white">
          {contacts.map((c) => (
            <option key={c.phone} value={c.phone}>
              {c.name} · {c.phone}
            </option>
          ))}
        </select>
      </label>

      <div className="w-80 rounded-[2.5rem] border-4 border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-2 flex justify-between px-1 text-[11px] text-slate-400">
          <span>{name.split(" ")[0]} · MTN NG</span>
          <span>▮▮▮ 92%</span>
        </div>
        <div className="h-96 overflow-y-auto rounded-xl bg-[#c9d8b6] p-3 font-mono text-[13px] leading-snug text-slate-900">
          {screen === "inbox" && (
            <div className="flex flex-col gap-2">
              <p className="font-bold">Messages ({inbox.length})</p>
              {inbox.length === 0 && <p className="opacity-70">No messages yet.</p>}
              {inbox.map((m) => (
                <div key={m.id} className={`rounded-md bg-white/60 p-2 ${m.id === fresh ? "animate-pop ring-2 ring-brand-600" : ""}`}>
                  <p className="text-[10px] font-bold opacity-70">LevyPass · {m.at ? new Date(m.at).toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos" }) : ""}</p>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                </div>
              ))}
            </div>
          )}
          {screen === "dial" && (
            <div className="flex h-full flex-col justify-between">
              <p className="opacity-70">Dial a code. LevyPass is {OUR_CODE}. Bank codes look like *7272*000*1234#.</p>
              <p className="break-all text-center text-2xl font-bold">{dial || " "}</p>
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
                  <input autoFocus value={reply} onChange={(e) => setReply(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-600 bg-white/70 px-2 py-1" aria-label="USSD reply" />
                  <button disabled={busy} className="rounded bg-slate-900 px-3 py-1 text-white">
                    Send
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={() => setScreen("inbox")} className="rounded-lg bg-slate-700 py-2 text-xs font-semibold text-white">
            Inbox
          </button>
          <button onClick={() => (screen === "dial" ? void call() : setScreen("dial"))} disabled={busy} className="rounded-lg bg-brand-600 py-2 text-xs font-bold text-white">
            {screen === "dial" ? "Call" : "Dial"}
          </button>
          <button onClick={() => (screen === "dial" ? setDial((d) => d.slice(0, -1)) : setScreen("inbox"))} className="rounded-lg bg-red-700 py-2 text-xs font-semibold text-white">
            {screen === "dial" ? "Del" : "End"}
          </button>
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => {
                if (screen === "ussd" && ussd?.open) setReply((r) => r + k);
                else {
                  if (screen !== "dial") setDial("");
                  setScreen("dial");
                  setDial((d) => d + k);
                }
              }}
              className="rounded-lg bg-slate-800 py-2 text-lg font-semibold text-white active:bg-slate-600"
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
