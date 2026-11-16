import { useState, type FormEvent } from 'react'
import { usePlannerStore } from '../../store/plannerStore'

const MM_PER_CM = 10
const LIMITS_CM = {
  width: { min: 100, max: 2000 },
  depth: { min: 100, max: 2000 },
  ceilingHeight: { min: 180, max: 600 },
}

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

export const RoomWizard = ({ onClose }: Props) => {
  const createRoom = usePlannerStore((state) => state.createRoom)
  const roomCount = usePlannerStore((state) => state.rooms.length)
  const [name, setName] = useState(`Pièce ${roomCount + 1}`)
  const [widthCm, setWidthCm] = useState(400)
  const [depthCm, setDepthCm] = useState(300)
  const [heightCm, setHeightCm] = useState(250)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
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
        <div>
          <h2 id="room-wizard-title" className="text-lg font-semibold">
            Nouvelle pièce
          </h2>
          <p className="text-sm text-stone-500">Une pièce rectangulaire, modifiable ensuite.</p>
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

        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Largeur" value={widthCm} limits={LIMITS_CM.width} onChange={setWidthCm} />
          <NumberField label="Profondeur" value={depthCm} limits={LIMITS_CM.depth} onChange={setDepthCm} />
        </div>
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
            Créer la pièce
          </button>
        </div>
      </form>
    </div>
  )
}
