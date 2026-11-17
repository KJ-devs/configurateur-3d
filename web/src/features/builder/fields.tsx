import { Minus, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Range } from '../../engine/limits'

const MM_PER_CM = 10

const toCmText = (mm: number): string => (Math.round(mm) / MM_PER_CM).toLocaleString('fr-FR', { maximumFractionDigits: 1 })

const parseCm = (text: string): number | null => {
  const cm = Number.parseFloat(text.replace(',', '.'))
  return Number.isFinite(cm) ? Math.round(cm * MM_PER_CM) : null
}

const inputClass =
  'w-16 rounded-md border border-stone-200 bg-white px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:bg-stone-50 disabled:text-stone-400'

type CmInputProps = { value: number; onCommit: (mm: number) => void; label: string; disabled?: boolean }

/** Centimetre input that only commits on Enter or blur, so typing never fights the live preview. */
export const CmInput = ({ value, onCommit, label, disabled }: CmInputProps) => {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    const mm = draft === null ? null : parseCm(draft)
    setDraft(null)
    if (mm !== null && mm !== Math.round(value)) onCommit(mm)
  }

  return (
    <label className="flex items-center gap-1 text-xs text-stone-500">
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        disabled={disabled}
        value={draft ?? toCmText(value)}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setDraft(null)
        }}
        className={inputClass}
      />
      cm
    </label>
  )
}

type DimensionFieldProps = {
  label: string
  value: number
  range: Range
  step?: number
  onChange: (mm: number) => void
  onChangeEnd: () => void
}

/** Slider for quick changes and a centimetre input for exact values. */
export const DimensionField = ({ label, value, range, step = 10, onChange, onChangeEnd }: DimensionFieldProps) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <span className="text-sm text-stone-700">{label}</span>
      <CmInput value={value} label={`${label} en centimètres`} onCommit={(mm) => { onChange(Math.min(Math.max(mm, range.min), range.max)); onChangeEnd() }} />
    </div>
    <input
      type="range"
      min={range.min}
      max={range.max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerUp={onChangeEnd}
      onKeyUp={onChangeEnd}
      className="w-full accent-accent"
    />
  </div>
)

type StepperProps = { label: string; value: number; min: number; max: number; onChange: (value: number) => void }

export const Stepper = ({ label, value, min, max, onChange }: StepperProps) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-stone-700">{label}</span>
    <div className="flex items-center rounded-lg border border-stone-200 bg-white">
      <button type="button" aria-label={`Moins de ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="p-1.5 text-stone-600 hover:text-accent disabled:opacity-30">
        <Minus size={14} />
      </button>
      <span className="w-6 text-center text-sm tabular-nums">{value}</span>
      <button type="button" aria-label={`Plus de ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="p-1.5 text-stone-600 hover:text-accent disabled:opacity-30">
        <Plus size={14} />
      </button>
    </div>
  </div>
)

type SwitchProps = { label: string; checked: boolean; onChange: (checked: boolean) => void }

export const Switch = ({ label, checked, onChange }: SwitchProps) => (
  <label className="flex cursor-pointer items-center justify-between text-sm text-stone-700">
    {label}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-accent' : 'bg-stone-300'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-4.5' : 'left-0.5'}`} />
    </button>
  </label>
)

type SegmentedProps<T extends string | number> = {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

export const Segmented = <T extends string | number>({ label, options, value, onChange }: SegmentedProps<T>) => (
  <div role="group" aria-label={label} className="flex items-center justify-between gap-2 text-sm text-stone-700">
    {label}
    <div className="flex rounded-lg bg-stone-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => option.value !== value && onChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-xs ${option.value === value ? 'bg-white text-accent shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
)

export const Section =({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3 border-b border-stone-200 p-4 last:border-b-0">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
    {children}
  </section>
)
