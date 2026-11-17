import { AlertTriangle, Check } from 'lucide-react'
import { estimatePrice } from '../../engine/analysis'
import { clamp, DIMENSION_LIMITS } from '../../engine/limits'
import type { HandleStyle, ParametricFurniture } from '../../engine/schema'
import { setOption } from '../../engine/tree'
import { formatPrice } from '../../lib/units'
import { panelMaterials, useBuilderStore } from '../../store/builderStore'
import { usePlannerStore } from '../../store/plannerStore'
import { ColorField } from './ColorField'
import { DimensionField, Section, Segmented, Switch } from './fields'
import { useBuilderLayout } from './useBuilderLayout'

type Dimension = 'width' | 'height' | 'depth' | 'plinthHeight'

const DIMENSIONS: { key: Exclude<Dimension, 'plinthHeight'>; label: string }[] = [
  { key: 'width', label: 'Largeur' },
  { key: 'height', label: 'Hauteur' },
  { key: 'depth', label: 'Profondeur' },
]

const DEFAULT_PLINTH = 80

const Finish = ({ furniture }: { furniture: ParametricFurniture }) => {
  const materials = usePlannerStore((state) => state.materials)
  const edit = useBuilderStore((state) => state.edit)

  return (
    <div className="grid grid-cols-2 gap-2">
      {panelMaterials(materials).map((material) => {
        const isActive = material.id === furniture.materialId
        return (
          <button
            key={material.id}
            type="button"
            aria-pressed={isActive}
            onClick={() =>
              edit((current) => ({ ...current, materialId: material.id, panelThickness: material.thicknesses[0] ?? current.panelThickness }))
            }
            className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition ${
              isActive ? 'border-accent ring-2 ring-accent-soft' : 'border-stone-200 hover:border-stone-400'
            }`}
          >
            <span className="relative h-8 w-8 shrink-0 rounded-md ring-1 ring-black/10" style={{ backgroundColor: material.colorHex }}>
              {isActive && <Check size={14} className="absolute inset-0 m-auto text-white mix-blend-difference" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium">{material.name}</span>
              <span className="block text-[11px] text-stone-500">{formatPrice(material.pricePerM2)}/m²</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const SLIDING_COUNTS: { value: number; label: string }[] = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
]

const HANDLE_STYLES: { value: HandleStyle; label: string }[] = [
  { value: 'bar', label: 'Barre' },
  { value: 'knob', label: 'Bouton' },
  { value: 'none', label: 'Sans' },
]

const FALLBACK_COLOR = '#c8a97e'

const Colors = ({ furniture }: { furniture: ParametricFurniture }) => {
  const materialColor = usePlannerStore((state) => state.materials[furniture.materialId]?.colorHex) ?? FALLBACK_COLOR
  return (
    <>
      <ColorField
        label="Couleur du meuble"
        resetLabel="Teinte du matériau"
        resetColor={materialColor}
        value={furniture.color}
        gestureKey="carcass"
        apply={(current, color) => setOption(current, 'color', color)}
      />
      <ColorField
        label="Couleur des façades"
        resetLabel="Comme le meuble"
        resetColor={furniture.color ?? materialColor}
        value={furniture.frontColor}
        gestureKey="fronts"
        apply={(current, color) => setOption(current, 'frontColor', color)}
      />
      <p className="text-[11px] text-stone-500">
        Pour peindre un seul compartiment, sélectionnez-le dans la vue. Une teinte personnalisée ajoute 20 % au prix des panneaux.
      </p>
    </>
  )
}

const Summary = () => {
  const builder = useBuilderLayout()
  const material = usePlannerStore((state) => (builder ? state.materials[builder.furniture.materialId] : undefined))
  const selectCell = useBuilderStore((state) => state.selectCell)
  if (!builder) return null

  const { price, panelArea } = estimatePrice(builder.layout, material?.pricePerM2 ?? 0, builder.furniture.color !== undefined)
  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-stone-500">Prix estimé</p>
          <p className="text-2xl font-semibold tabular-nums">{formatPrice(price)}</p>
        </div>
        <p className="text-right text-xs text-stone-500">
          {builder.layout.cells.length} compartiment{builder.layout.cells.length > 1 ? 's' : ''}
          <br />
          {panelArea.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} m² de panneaux
        </p>
      </div>
      {builder.issues.length > 0 && (
        <ul className="flex flex-col gap-1">
          {builder.issues.map((issue) => (
            <li key={`${issue.cellId}:${issue.message}`}>
              <button
                type="button"
                onClick={() => selectCell(issue.cellId)}
                className="flex w-full items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-left text-xs text-amber-800 hover:bg-amber-100"
              >
                <AlertTriangle size={14} className="mt-px shrink-0" />
                {issue.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Settings of the whole piece: size, base, back panel and finish. */
export const FurniturePanel = () => {
  const furniture = useBuilderStore((state) => state.furniture)
  const edit = useBuilderStore((state) => state.edit)
  const endGesture = useBuilderStore((state) => state.endGesture)
  if (!furniture) return null

  const setDimension = (key: Dimension, mm: number) =>
    edit((current) => (current[key] === mm ? current : { ...current, [key]: clamp(mm, DIMENSION_LIMITS[key]) }), `dimension:${key}`)

  return (
    <div className="flex flex-col">
      <Section title="Dimensions extérieures">
        {DIMENSIONS.map(({ key, label }) => (
          <DimensionField
            key={key}
            label={label}
            value={furniture[key]}
            range={DIMENSION_LIMITS[key]}
            onChange={(mm) => setDimension(key, mm)}
            onChangeEnd={endGesture}
          />
        ))}
      </Section>

      <Section title="Caisson">
        <Switch
          label="Socle"
          checked={furniture.plinthHeight > 0}
          onChange={(checked) => setDimension('plinthHeight', checked ? DEFAULT_PLINTH : 0)}
        />
        {furniture.plinthHeight > 0 && (
          <DimensionField
            label="Hauteur du socle"
            value={furniture.plinthHeight}
            range={{ ...DIMENSION_LIMITS.plinthHeight, min: 40 }}
            step={5}
            onChange={(mm) => setDimension('plinthHeight', mm)}
            onChangeEnd={endGesture}
          />
        )}
        <Switch label="Panneau de fond" checked={furniture.hasBack} onChange={(hasBack) => edit((current) => ({ ...current, hasBack }))} />
      </Section>

      <Section title="Façade">
        <Switch
          label="Portes coulissantes"
          checked={furniture.slidingDoors !== undefined}
          onChange={(checked) => edit((current) => setOption(current, 'slidingDoors', checked ? { count: 2 } : null))}
        />
        {furniture.slidingDoors && (
          <Segmented
            label="Nombre de portes"
            options={SLIDING_COUNTS}
            value={furniture.slidingDoors.count}
            onChange={(count) => edit((current) => setOption(current, 'slidingDoors', { count }))}
          />
        )}
        <Segmented
          label="Poignées"
          options={HANDLE_STYLES}
          value={furniture.handle ?? 'bar'}
          onChange={(handle) => edit((current) => setOption(current, 'handle', handle === 'bar' ? null : handle))}
        />
      </Section>

      <Section title="Finition">
        <Finish furniture={furniture} />
        <Colors furniture={furniture} />
      </Section>

      <Section title="Récapitulatif">
        <Summary />
      </Section>
    </div>
  )
}
