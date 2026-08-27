import type { ReactNode } from 'react'

export const TEAM_STYLE = [
  { text: 'text-team-a', bg: 'bg-team-a', on: 'text-team-a-ink',
    soft: 'bg-team-a-wash', ring: 'ring-team-a' },
  { text: 'text-team-b', bg: 'bg-team-b', on: 'text-team-b-ink',
    soft: 'bg-team-b-wash', ring: 'ring-team-b' },
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
    primary: 'bg-team-a text-team-a-ink shadow-sm active:brightness-90',
    subtle: 'bg-surface text-ink border border-line active:bg-surface-2',
    ghost: 'bg-transparent text-ink-soft active:bg-surface-2',
    danger: 'bg-surface text-coral border border-coral active:bg-coral-wash',
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
    <div className={`rounded-2xl bg-surface shadow-sm ring-1 ring-line ${className}`}>
      {children}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full min-h-[3rem] rounded-xl border border-line bg-surface px-3 text-base ' +
  'outline-none focus:border-team-a focus:ring-2 focus:ring-team-a'

export function SyncBadge({ pending, database }: { pending: number; database: boolean }) {
  if (!database) {
    return <span className="rounded-full bg-gold-wash px-2 py-1 text-xs font-semibold text-gold">
      phone only
    </span>
  }
  return pending > 0
    ? <span className="rounded-full bg-gold-wash px-2 py-1 text-xs font-semibold text-gold tnum">
        ⟳ {pending} pending
      </span>
    : <span className="rounded-full bg-team-a-wash px-2 py-1 text-xs font-semibold text-team-a">
        ✓ synced
      </span>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      {children && <p className="mt-2 text-sm text-ink-soft">{children}</p>}
    </div>
  )
}
