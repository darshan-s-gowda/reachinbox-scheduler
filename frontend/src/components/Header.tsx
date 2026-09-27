import type { User } from "../types/email";

export function Header({ user, onLogout }: { user: User; onLogout: () => void }) {
  return <header className="border-b border-zinc-200 bg-[#fdfdfc]">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
      <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-sm bg-zinc-900 text-sm font-semibold text-white">R</div><span className="font-semibold tracking-tight">ReachInbox</span></div>
      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block"><div className="text-sm font-medium">{user.name}</div><div className="text-xs text-zinc-500">{user.email}</div></div>
        {user.avatar ? <img src={user.avatar} alt="" className="h-9 w-9 rounded-sm border border-zinc-200" /> : <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-zinc-100 text-sm">{user.name.charAt(0)}</div>}
        <button onClick={onLogout} className="text-sm text-zinc-600 hover:text-zinc-950">Logout</button>
      </div>
    </div>
  </header>;
}
