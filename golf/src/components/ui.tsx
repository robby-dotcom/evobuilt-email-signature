import type { ReactNode } from 'react'

export const TEAM_STYLE = [
  { text: 'text-emerald-700', bg: 'bg-emerald-600', soft: 'bg-emerald-50', ring: 'ring-emerald-600' },
  { text: 'text-indigo-700', bg: 'bg-indigo-600', soft: 'bg-indigo-50', ring: 'ring-indigo-600' },
] as const

export function Button({
  children, onClick, variant = 'primary', disabled, className = '', type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  const styles = {
    primary: 'bg-emerald-700 text-white active:bg-emerald-800 shadow-sm',
    subtle: 'bg-white text-slate-900 border border-slate-300 active:bg-slate-100',
    ghost: 'bg-transparent text-slate-600 active:bg-slate-200',
    danger: 'bg-white text-red-700 border border-red-300 active:bg-red-50',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[3rem] rounded-xl px-4 font-semibold disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full min-h-[3rem] rounded-xl border border-slate-300 bg-white px-3 text-base ' +
  'outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200'

export function SyncBadge({ pending, database }: { pending: number; database: boolean }) {
  if (!database) {
    return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
      phone only
    </span>
  }
  return pending > 0
    ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 tnum">
        ⟳ {pending} pending
      </span>
    : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
        ✓ synced
      </span>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-lg font-semibold text-slate-700">{title}</p>
      {children && <p className="mt-2 text-sm text-slate-500">{children}</p>}
    </div>
  )
}
