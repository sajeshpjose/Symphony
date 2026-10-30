import clsx from 'clsx'
import { FileText, Lightbulb, LogOut, Search, SlidersHorizontal, Users } from 'lucide-react'
import { NavLink } from 'react-router'
import { useAuth } from '../lib/auth'
import { Mark } from '../report/Mark'
import { supabase } from '../lib/supabase'

const groups = [
  { label: 'Workspace', items: [{ to: '/clients', label: 'Clients', icon: Users }, { to: '/research', label: 'Research', icon: Search }] },
  { label: 'Content', items: [{ to: '/topics', label: 'Topics', icon: Lightbulb }, { to: '/content', label: 'Content', icon: FileText }] },
  { label: 'Admin', items: [{ to: '/settings', label: 'Settings', icon: SlidersHorizontal }] },
]

export function Sidebar() {
  const { session } = useAuth()
  const email = session?.user.email ?? ''
  return (
    <aside className="sticky top-2 flex h-[calc(100vh-16px)] w-[232px] shrink-0 flex-col rounded-lg bg-side p-4 text-side-text">
      <div className="px-2">
        <Mark size={28} color="currentColor" className="text-canvas" />
      </div>
      <span className="mt-4 ml-2 w-fit rounded-[3px] bg-highlight px-1.5 py-px text-xs font-medium text-side-active">MVP</span>
      <nav className="mt-5 flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-side-muted uppercase">{g.label}</div>
            {g.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors',
                    isActive ? 'bg-side-active text-canvas' : 'hover:bg-side-item hover:text-canvas',
                  )
                }
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 rounded-md bg-side-item p-3">
        <div className="grid size-8 place-items-center rounded-full bg-side-active text-xs font-medium text-canvas">
          {email.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-canvas">{email}</div>
          <div className="text-xs text-side-muted">Agency owner</div>
        </div>
        <button title="Sign out" onClick={() => supabase.auth.signOut()} className="text-side-muted hover:text-canvas">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  )
}
