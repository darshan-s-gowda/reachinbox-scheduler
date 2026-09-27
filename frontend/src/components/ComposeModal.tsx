import { useMemo, useState } from "react";
import Papa from "papaparse";
import { api } from "../services/api";

function extractEmails(text: string) { const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []; return [...new Set(matches.map(v => v.toLowerCase()))]; }

export function ComposeModal({ userEmail, onClose, onScheduled }: { userEmail: string; onClose: () => void; onScheduled: () => void }) {
  const [sender, setSender] = useState(userEmail); const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [recipients, setRecipients] = useState<string[]>([]); const [startTime, setStartTime] = useState(() => new Date(Date.now() + 5 * 60000).toISOString().slice(0,16)); const [delay, setDelay] = useState(2000); const [hourlyLimit, setHourlyLimit] = useState(100); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const count = useMemo(() => recipients.length, [recipients]);
  const handleFile = (file?: File) => {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Maximum allowed size is 5 MB.");
      return;
    }
    const allowed = ["text/csv", "text/plain", "application/vnd.ms-excel", ""];
    const extensionOk = /\.(csv|txt)$/i.test(file.name);
    if (!extensionOk || (file.type && !allowed.includes(file.type))) {
      setError("Only CSV or plain-text lead files are allowed.");
      return;
    }
    Papa.parse<string[]>(file, { complete: result => { const raw = result.data.flat().join("\n"); setRecipients(extractEmails(raw)); }, error: e => setError(e.message) }); };
  async function submit(e: React.FormEvent) { e.preventDefault(); setError(""); if (!recipients.length) return setError("Upload a CSV or text file containing at least one email address."); setBusy(true); try { await api.schedule({ sender, recipients, subject, body, startTime: new Date(startTime).toISOString(), delayMs: Number(delay), hourlyLimit: Number(hourlyLimit) }); onScheduled(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to schedule emails"); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-zinc-200 bg-[#fdfdfc] p-6 ">
    <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">Compose new email</h2><p className="mt-1 text-sm text-zinc-500">Schedule a controlled batch of outbound emails.</p></div><button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-900">✕</button></div>
    <div className="mt-6 grid gap-4"><label className="text-sm font-medium">Sender<input value={sender} onChange={e=>setSender(e.target.value)} className="mt-1 w-full rounded-sm border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900" type="email" required /></label>
    <label className="text-sm font-medium">Subject<input value={subject} onChange={e=>setSubject(e.target.value)} className="mt-1 w-full rounded-sm border border-zinc-300 px-3 py-2" required /></label>
    <label className="text-sm font-medium">Body<textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} className="mt-1 w-full resize-y rounded-sm border border-zinc-300 px-3 py-2" required /></label>
    <label className="text-sm font-medium">Leads CSV / text<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e=>handleFile(e.target.files?.[0])} className="mt-1 block w-full rounded-sm border border-zinc-300 p-2 text-sm" /></label>
    <div className="rounded-sm bg-zinc-50 px-3 py-2 text-sm text-zinc-600">{count} unique email addresses detected</div>
    <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Start time<input type="datetime-local" value={startTime} onChange={e=>setStartTime(e.target.value)} className="mt-1 w-full rounded-sm border border-zinc-300 px-3 py-2" /></label><label className="text-sm font-medium">Delay (ms)<input type="number" min={0} value={delay} onChange={e=>setDelay(Number(e.target.value))} className="mt-1 w-full rounded-sm border border-zinc-300 px-3 py-2" /></label><label className="text-sm font-medium">Hourly limit<input type="number" min={1} value={hourlyLimit} onChange={e=>setHourlyLimit(Number(e.target.value))} className="mt-1 w-full rounded-sm border border-zinc-300 px-3 py-2" /></label></div>
    {error && <div className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    <div className="mt-2 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-sm border border-zinc-300 px-4 py-2 text-sm">Cancel</button><button disabled={busy} className="rounded-sm bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Scheduling…" : "Schedule"}</button></div>
    </div></form></div>;
}
