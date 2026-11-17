import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { definitionOf } from '../../engine/furniture'
import { DEFAULT_PANEL_THICKNESS } from '../../engine/limits'
import type { ParametricFurniture } from '../../engine/schema'
import { TEMPLATES } from '../../engine/templates'
import { formatDimensions } from '../../lib/units'
import { DEFAULT_CATEGORY, panelMaterials, useBuilderStore, type BuilderStart } from '../../store/builderStore'
import { usePlannerStore } from '../../store/plannerStore'
import { FrontPreview } from '../furniture/FrontPreview'

const PREVIEW_SIZE = 76
const FALLBACK_COLOR = '#c8a97e'

type Choice = { key: string; title: string; subtitle: string; start: BuilderStart }

const ChoiceCard = ({ choice, color, onPick }: { choice: Choice; color: string; onPick: (start: BuilderStart) => void }) => {
  const { furniture } = choice.start
  return (
    <button
      type="button"
      onClick={() => onPick(choice.start)}
      className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition hover:border-accent hover:shadow-md focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
    >
      <span className="flex h-24 w-full items-end justify-center bg-stone-100 pb-2">
        <FrontPreview furniture={furniture} color={color} maxSize={PREVIEW_SIZE} />
      </span>
      <span className="flex flex-col gap-0.5 p-2">
        <span className="text-xs font-medium leading-tight">{choice.title}</span>
        <span className="text-[11px] text-stone-500">{choice.subtitle}</span>
        <span className="text-[11px] text-stone-400">{formatDimensions(furniture.width, furniture.height, furniture.depth)}</span>
      </span>
    </button>
  )
}

const useChoices = (): { templates: Choice[]; copies: Choice[] } => {
  const materials = usePlannerStore((state) => state.materials)
  const models = usePlannerStore((state) => state.models)

  return useMemo(() => {
    const material = panelMaterials(materials)[0]
    const thickness = material?.thicknesses[0] ?? DEFAULT_PANEL_THICKNESS
    const templates = TEMPLATES.map((template) => ({
      key: template.key,
      title: template.name,
      subtitle: template.description,
      start: { furniture: template.build(material?.id ?? '', thickness), name: template.name, category: DEFAULT_CATEGORY },
    }))
    const copies = Object.values(models)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .flatMap((model): Choice[] => {
        const furniture: ParametricFurniture | null = definitionOf(model)
        if (!furniture) return []
        return [{ key: model.id, title: model.name, subtitle: model.category, start: { furniture, name: `${model.name} (variante)`, category: model.category } }]
      })
    return { templates, copies }
  }, [materials, models])
}

type Props = { onClose: () => void }

/** First step of a new piece of furniture: pick a template or a catalog piece to start from. */
export const TemplatePicker = ({ onClose }: Props) => {
  const materials = usePlannerStore((state) => state.materials)
  const openBuilder = useBuilderStore((state) => state.open)
  const { templates, copies } = useChoices()
  const colorOf = (furniture: ParametricFurniture) => materials[furniture.materialId]?.colorHex ?? FALLBACK_COLOR

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const pick = (start: BuilderStart) => {
    onClose()
    openBuilder({ kind: 'new' }, start)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 p-5">
          <div>
            <h2 id="template-picker-title" className="text-lg font-semibold">
              Créer un meuble
            </h2>
            <p className="text-sm text-stone-500">Choisissez un point de départ : tout reste modifiable ensuite.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto p-5">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Modèles de base</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {templates.map((choice) => (
                <ChoiceCard key={choice.key} choice={choice} color={colorOf(choice.start.furniture)} onPick={pick} />
              ))}
            </div>
          </section>

          {copies.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">À partir d'un meuble du catalogue</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {copies.map((choice) => (
                  <ChoiceCard key={choice.key} choice={choice} color={colorOf(choice.start.furniture)} onPick={pick} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
