import { PenLine, Square } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { usePlannerStore } from '../../store/plannerStore'

const MM_PER_CM = 10
const LIMITS_CM = {
  width: { min: 100, max: 2000 },
  depth: { min: 100, max: 2000 },
  ceilingHeight: { min: 180, max: 600 },
}

type Shape = 'rectangle' | 'freehand'
type Props = { onClose: () => void }

type NumberFieldProps = {
  label: string
  value: number
  limits: { min: number; max: number }
  onChange: (value: number) => void
}

const NumberField = ({ label, value, limits, onChange }: NumberFieldProps) => (
  <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
    {label}
    <div className="flex items-center rounded-lg border border-stone-200 bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft">
      <input
        type="number"
        required
        min={limits.min}
        max={limits.max}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="w-full bg-transparent px-3 py-2 text-sm text-stone-900 outline-none"
      />
      <span className="pr-3 text-stone-400">cm</span>
    </div>
  </label>
)

type ShapeOptionProps = { isActive: boolean; icon: ReactNode; title: string; hint: string; onSelect: () => void }

const ShapeOption = ({ isActive, icon, title, hint, onSelect }: ShapeOptionProps) => (
  <button
    type="button"
    aria-pressed={isActive}
    onClick={onSelect}
    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
      isActive ? 'border-accent bg-accent-soft' : 'border-stone-200 hover:border-stone-300'
    }`}
  >
    <span className={isActive ? 'text-accent' : 'text-stone-500'}>{icon}</span>
    <span className="text-sm font-medium">{title}</span>
    <span className="text-xs text-stone-500">{hint}</span>
  </button>
)

export const RoomWizard = ({ onClose }: Props) => {
  const createRoom = usePlannerStore((state) => state.createRoom)
  const startDrawing = usePlannerStore((state) => state.startDrawing)
  const roomCount = usePlannerStore((state) => state.rooms.length)
  const [shape, setShape] = useState<Shape>('rectangle')
  const [name, setName] = useState(`Pièce ${roomCount + 1}`)
  const [widthCm, setWidthCm] = useState(400)
  const [depthCm, setDepthCm] = useState(300)
  const [heightCm, setHeightCm] = useState(250)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (shape === 'freehand') {
      startDrawing(name.trim(), heightCm * MM_PER_CM)
      return onClose()
    }

    setIsSubmitting(true)
    await createRoom({
      name: name.trim(),
      width: widthCm * MM_PER_CM,
      depth: depthCm * MM_PER_CM,
      ceilingHeight: heightCm * MM_PER_CM,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-wizard-title"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="room-wizard-title" className="text-lg font-semibold">
          Nouvelle pièce
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <ShapeOption
            isActive={shape === 'rectangle'}
            icon={<Square size={20} />}
            title="Rectangle"
            hint="Saisir les dimensions"
            onSelect={() => setShape('rectangle')}
          />
          <ShapeOption
            isActive={shape === 'freehand'}
            icon={<PenLine size={20} />}
            title="Dessin libre"
            hint="Tracer les murs sur le plan"
            onSelect={() => setShape('freehand')}
          />
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Nom
          <input
            autoFocus
            required
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </label>

        {shape === 'rectangle' && (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Largeur" value={widthCm} limits={LIMITS_CM.width} onChange={setWidthCm} />
            <NumberField label="Profondeur" value={depthCm} limits={LIMITS_CM.depth} onChange={setDepthCm} />
          </div>
        )}
        <NumberField label="Hauteur sous plafond" value={heightCm} limits={LIMITS_CM.ceilingHeight} onChange={setHeightCm} />

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
          >
            {shape === 'rectangle' ? 'Créer la pièce' : 'Commencer le tracé'}
          </button>
        </div>
      </form>
    </div>
  )
}
