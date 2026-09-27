import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { EmailTable } from "../components/EmailTable";
import { ComposeModal } from "../components/ComposeModal";
import { api } from "../services/api";
import type { Email, User } from "../types/email";

export function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<"scheduled"|"sent">("scheduled"); const [emails, setEmails] = useState<Email[]>([]); const [loading, setLoading] = useState(true); const [compose, setCompose] = useState(false); const [slack, setSlack] = useState(false); const [search, setSearch] = useState(""); const [searching, setSearching] = useState(false);
  async function load() { setLoading(true); try { setEmails(tab === "scheduled" ? await api.scheduled() : await api.sent()); } finally { setLoading(false); } }
  useEffect(()=>{load().catch(()=>setLoading(false));},[tab]);
  useEffect(()=>{api.slackStatus().then(x=>setSlack(x.connected)).catch(()=>undefined)},[]);
  async function doSearch() { if (!search.trim()) return load(); setSearching(true); try { setEmails(await api.search(search.trim())); } finally { setSearching(false); } }
  return <><Header user={user} onLogout={onLogout}/><main className="mx-auto max-w-7xl px-6 py-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="text-sm font-medium text-zinc-500">Workspace</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Email scheduler</h1><p className="mt-2 text-sm text-zinc-500">Reliable scheduled delivery backed by BullMQ and Redis.</p></div><div className="flex gap-2"><a href={`${api.base}/api/slack/connect`} className="rounded-sm border border-zinc-300 px-4 py-2 text-sm">{slack ? "Slack connected" : "Connect Slack"}</a><button onClick={()=>setCompose(true)} className="rounded-sm bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Compose new email</button></div></div>
    <div className="mt-8 flex flex-col gap-3 border-b border-zinc-200 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-5"><button onClick={()=>setTab("scheduled")} className={`border-b-2 px-1 pb-3 text-sm ${tab==="scheduled"?"border-zinc-900 font-medium":"border-transparent text-zinc-500"}`}>Scheduled</button><button onClick={()=>setTab("sent")} className={`border-b-2 px-1 pb-3 text-sm ${tab==="sent"?"border-zinc-900 font-medium":"border-transparent text-zinc-500"}`}>Sent</button></div><div className="mb-2 flex gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Search emails" className="h-9 w-52 rounded-sm border border-zinc-300 px-3 text-sm"/><button onClick={doSearch} className="rounded-sm border border-zinc-300 px-3 text-sm">{searching?"…":"Search"}</button></div></div>
    <div className="mt-5"><EmailTable emails={emails} loading={loading} sent={tab === "sent"}/></div></main>{compose&&<ComposeModal userEmail={user.email} onClose={()=>setCompose(false)} onScheduled={()=>{setCompose(false); setTab("scheduled"); load();}}/>}</>;
}
