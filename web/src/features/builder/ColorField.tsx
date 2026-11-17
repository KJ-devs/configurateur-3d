import { Check, Pipette } from 'lucide-react'
import type { ParametricFurniture } from '../../engine/schema'
import { useBuilderStore } from '../../store/builderStore'

const PALETTE: { color: string; name: string }[] = [
  { color: '#f5f3ee', name: 'Blanc cassé' },
  { color: '#d6d3cd', name: 'Gris perle' },
  { color: '#8a8d91', name: 'Gris béton' },
  { color: '#3a3d42', name: 'Anthracite' },
  { color: '#1c1c1e', name: 'Noir' },
  { color: '#8fa58c', name: 'Sauge' },
  { color: '#3f5a4a', name: 'Vert forêt' },
  { color: '#2c3e5c', name: 'Bleu nuit' },
  { color: '#7fa3bf', name: 'Bleu ciel' },
  { color: '#c4704f', name: 'Terracotta' },
  { color: '#d9a84e', name: 'Moutarde' },
  { color: '#e4b7b0', name: 'Rose poudré' },
]

const swatchClass = (isActive: boolean): string =>
  `relative h-7 w-7 rounded-full ring-1 ring-black/15 transition hover:scale-110 ${isActive ? 'ring-2 ring-accent ring-offset-2' : ''}`

type Props = {
  label: string
  /** Name of the "no colour" option, e.g. "Comme le caisson". */
  resetLabel: string
  /** Colour shown on the reset option. */
  resetColor: string
  value: string | undefined
  /** Identifies the target, so dragging in the colour picker makes a single undo step. */
  gestureKey: string
  /** Builds the edit for a colour, or for going back to the default with null. */
  apply: (furniture: ParametricFurniture, color: string | null) => ParametricFurniture
}

/** Palette, free colour picker and a way back to the default colour. */
export const ColorField = ({ label, resetLabel, resetColor, value, gestureKey, apply }: Props) => {
  const edit = useBuilderStore((state) => state.edit)
  const isPaletteColor = PALETTE.some(({ color }) => color === value)
  const pick = (color: string | null) => edit((current) => apply(current, color))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-stone-700">
        {label}
        <button
          type="button"
          aria-pressed={value === undefined}
          onClick={() => pick(null)}
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
            value === undefined ? 'bg-accent-soft text-accent' : 'text-stone-500 hover:bg-stone-100'
          }`}
        >
          <span className="h-3 w-3 rounded-full ring-1 ring-black/15" style={{ backgroundColor: resetColor }} />
          {resetLabel}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map(({ color, name }) => (
          <button
            key={color}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={value === color}
            onClick={() => pick(color)}
            className={swatchClass(value === color)}
            style={{ backgroundColor: color }}
          >
            {value === color && <Check size={14} className="absolute inset-0 m-auto text-white mix-blend-difference" />}
          </button>
        ))}
        <label
          title="Couleur libre"
          className={`${swatchClass(value !== undefined && !isPaletteColor)} flex cursor-pointer items-center justify-center`}
          style={{
            background: value && !isPaletteColor ? value : 'conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)',
          }}
        >
          <Pipette size={13} className="text-white mix-blend-difference" />
          <input
            type="color"
            aria-label={`${label} : couleur libre`}
            value={value ?? resetColor}
            onChange={(event) => edit((current) => apply(current, event.target.value), `color:${gestureKey}`)}
            onBlur={() => useBuilderStore.getState().endGesture()}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  )
}
