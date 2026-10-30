// Small UI kit styled after the Skipper design system.
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export { clsx as cx }

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean }

export function Button({ variant = 'secondary', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-ink text-canvas hover:bg-side-active',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-subtle',
        variant === 'ghost' && 'text-fg-2 hover:bg-subtle hover:text-ink',
        className,
      )}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

const chipTones = {
  neutral: 'bg-subtle text-fg-2',
  accent: 'bg-tint text-casal',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
}
export type Tone = keyof typeof chipTones

export function Chip({ tone = 'neutral', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap', chipTones[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function Card({ title, subtitle, action, children, className, flush }: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  flush?: boolean
}) {
  return (
    <section className={clsx('rounded-lg border border-line bg-surface', !flush && 'p-5', className)}>
      {title && (
        <header className={clsx('flex items-center gap-3', flush ? 'px-5 pt-5 pb-4' : 'mb-4')}>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-fg-2">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ crumb, title, subtitle, actions }: { crumb?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end gap-4">
      <div className="min-w-0 flex-1">
        {crumb && <div className="mb-1 text-xs font-medium text-fg-3">{crumb}</div>}
        <h1 className="font-serif text-[32px] leading-9 tracking-[-0.4px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, help, error, children, className }: { label?: ReactNode; help?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('flex flex-col gap-1.5', className)}>
      {label && <span className="text-xs font-medium text-fg-2">{label}</span>}
      {children}
      {error ? <span className="text-xs text-bad">{error}</span> : help && <span className="text-xs text-fg-3">{help}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-fg-3 focus:border-ink focus:outline-none'

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(inputCls, 'h-9', className)} />

export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={clsx(inputCls, 'min-h-20 resize-y', className)} />
)

export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('relative', className)}>
      <select {...p} className={clsx(inputCls, 'h-9 appearance-none pr-8')}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-fg-2" />
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-line-strong')}
    >
      <span className={clsx('absolute top-0.5 size-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

export function Pill({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        on ? 'border-ink bg-tint text-ink' : 'border-line bg-surface text-fg-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export function Note({ tone = 'accent', title, children }: { tone?: 'accent' | 'warn' | 'bad' | 'ok'; title?: ReactNode; children: ReactNode }) {
  const t = { accent: 'bg-tint text-casal', warn: 'bg-warn-bg text-warn', bad: 'bg-bad-bg text-bad', ok: 'bg-ok-bg text-ok' }[tone]
  return (
    <div className={clsx('rounded-md px-3.5 py-3', t)}>
      {title && <div className="text-sm font-medium">{title}</div>}
      <div className="text-xs text-ink">{children}</div>
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
      <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-subtle">
        <tr>
          {head.map((h, i) => (
            <th key={i} className="px-5 py-2.5 text-[11px] font-semibold tracking-wide text-fg-2 uppercase">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="[&>tr]:border-t [&>tr]:border-line [&_td]:px-5 [&_td]:py-3">{children}</tbody>
    </table>
  )
}

export function Empty({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="font-serif text-2xl">{title}</div>
      {children && <p className="max-w-md text-sm text-fg-2">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Slider({ label, value, onChange, left, right, valueLabel }: {
  label: string
  value: number
  onChange: (v: number) => void
  left: string
  right: string
  valueLabel: string
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-fg-2">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="mt-2 w-full accent-ink"
      />
      <div className="flex justify-between text-xs text-fg-3">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-md bg-subtle p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 rounded-sm px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
            o.value === value ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-fg-2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const tagTones = { neutral: 'bg-subtle text-fg-2', ok: 'bg-ok-bg text-ok', bad: 'bg-bad-bg text-bad' }

// Type a word and press Enter (or comma) to add it.
export function TagInput({ values, onChange, placeholder, tone = 'neutral' }: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  tone?: keyof typeof tagTones
}) {
  const add = (raw: string) => {
    const v = raw.trim().replace(/,$/, '')
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v])
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface p-1.5 focus-within:border-ink">
      {values.map((v) => (
        <span key={v} className={clsx('inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium', tagTones[tone])}>
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-60 hover:opacity-100">
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-fg-3"
        placeholder={values.length ? 'Add more…' : placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(e.currentTarget.value)
            e.currentTarget.value = ''
          } else if (e.key === 'Backspace' && !e.currentTarget.value && values.length) {
            onChange(values.slice(0, -1))
          }
        }}
        onBlur={(e) => {
          add(e.currentTarget.value)
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}
