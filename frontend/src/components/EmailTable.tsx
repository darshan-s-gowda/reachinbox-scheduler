import type { Email } from "../types/email";

function fmt(value: string | null | undefined) { return value ? new Date(value).toLocaleString() : "N/A"; }

export function EmailTable({ emails, sent, loading }: { emails: Email[]; sent?: boolean; loading: boolean }) {
  if (loading) return <div className="rounded-sm border border-zinc-200 bg-[#fdfdfc] p-8 text-center text-sm text-zinc-500">Loading emails…</div>;
  if (!emails.length) return <div className="rounded-sm border border-dashed border-zinc-300 bg-[#fdfdfc] p-12 text-center"><div className="text-sm font-medium text-zinc-800">No emails yet</div><div className="mt-1 text-sm text-zinc-500">{sent ? "Sent emails will appear here." : "Schedule an email campaign to see it here."}</div></div>;
  return <div className="overflow-hidden rounded-sm border border-zinc-200 bg-[#fdfdfc]">
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-5 py-3">Email</th><th className="px-5 py-3">Subject</th><th className="px-5 py-3">{sent ? "Sent time" : "Scheduled time"}</th><th className="px-5 py-3">Status</th></tr></thead>
      <tbody className="divide-y divide-zinc-100">{emails.map(email => <tr key={email.id} className="hover:bg-zinc-50"><td className="px-5 py-4 font-medium text-zinc-900">{email.recipient}</td><td className="max-w-xs truncate px-5 py-4 text-zinc-700">{email.subject}</td><td className="px-5 py-4 text-zinc-600">{fmt(sent ? email.sentAt : email.scheduledAt)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-sm px-2.5 py-1 text-xs font-medium ${email.status === "SENT" ? "bg-emerald-50 text-emerald-700" : email.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-700"}`}>{email.status.toLowerCase()}</span></td></tr>)}</tbody>
    </table></div></div>;
}
