import { Columns2, Combine, MousePointerClick, Rows2, StretchHorizontal, StretchVertical } from 'lucide-react'
import type { Cell } from '../../engine/layout'
import { MAX_DRAWERS, MAX_SHELVES, MIN_COMPARTMENT } from '../../engine/limits'
import type { Axis, Content, ContentKind, Hinge, ParametricFurniture } from '../../engine/schema'
import {
  distributeEvenly,
  mergeCell,
  pathTo,
  setCellColor,
  setChildAuto,
  setChildLength,
  setContent,
  sizeSlot,
  splitCell,
} from '../../engine/tree'
import { formatDimensions } from '../../lib/units'
import { useBuilderStore } from '../../store/builderStore'
import { usePlannerStore } from '../../store/plannerStore'
import { ColorField } from './ColorField'
import { ContentIcon } from './ContentIcon'
import { CmInput, Section, Segmented, Stepper } from './fields'
import { useBuilderLayout } from './useBuilderLayout'

const DRAWER_TARGET_HEIGHT = 180
const SHELF_TARGET_SPACING = 350

const CONTENTS: { kind: ContentKind; label: string }[] = [
  { kind: 'empty', label: 'Vide' },
  { kind: 'shelf', label: 'Étagères' },
  { kind: 'door', label: 'Porte' },
  { kind: 'glassDoor', label: 'Vitrée' },
  { kind: 'doubleDoor', label: 'Double porte' },
  { kind: 'flap', label: 'Abattant' },
  { kind: 'drawer', label: 'Tiroirs' },
  { kind: 'rail', label: 'Penderie' },
]

const HINGES: { value: Hinge; label: string }[] = [
  { value: 'left', label: 'À gauche' },
  { value: 'right', label: 'À droite' },
]

/** Shelves already in the compartment, kept when switching to doors and back. */
const shelvesIn = (content: Content): number | undefined => {
  if (content.kind === 'shelf') return content.count
  if (content.kind === 'door' || content.kind === 'glassDoor' || content.kind === 'doubleDoor') return content.shelves
  return undefined
}

/** A sensible default for the new content, given the size of the compartment and what it holds now. */
const contentFor = (kind: ContentKind, cell: Cell): Content => {
  const fits = (target: number, max: number) => Math.min(Math.max(1, Math.round(cell.rect.h / target)), max)
  const shelves = shelvesIn(cell.content) ?? Math.max(1, fits(SHELF_TARGET_SPACING, MAX_SHELVES) - 1)
  const hinge: Hinge = cell.content.kind === 'door' || cell.content.kind === 'glassDoor' ? cell.content.hinge : 'left'
  switch (kind) {
    case 'shelf':
      return { kind, count: Math.max(1, shelves) }
    case 'drawer':
      return { kind, count: fits(DRAWER_TARGET_HEIGHT, MAX_DRAWERS) }
    case 'door':
    case 'glassDoor':
      return { kind, hinge, shelves }
    case 'doubleDoor':
      return { kind, shelves }
    default:
      return { kind }
  }
}

const tileClass = (isActive: boolean): string =>
  `flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition ${
    isActive ? 'border-accent bg-accent-soft text-accent' : 'border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900'
  }`

const actionClass =
  'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-2 py-2 text-xs text-stone-700 hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40'

const ContentPicker = ({ cell }: { cell: Cell }) => {
  const edit = useBuilderStore((state) => state.edit)
  const update = (content: Content) => edit((current) => setContent(current, cell.id, content))
  const { content } = cell

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {CONTENTS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={content.kind === kind}
            onClick={() => content.kind !== kind && update(contentFor(kind, cell))}
            className={tileClass(content.kind === kind)}
          >
            <ContentIcon kind={kind} />
            {label}
          </button>
        ))}
      </div>
      {content.kind === 'shelf' && (
        <Stepper label="Étagères" value={content.count} min={1} max={MAX_SHELVES} onChange={(count) => update({ ...content, count })} />
      )}
      {content.kind === 'drawer' && (
        <Stepper label="Tiroirs" value={content.count} min={1} max={MAX_DRAWERS} onChange={(count) => update({ ...content, count })} />
      )}
      {(content.kind === 'door' || content.kind === 'glassDoor') && (
        <Segmented label="Charnières" options={HINGES} value={content.hinge} onChange={(hinge) => update({ ...content, hinge })} />
      )}
      {(content.kind === 'door' || content.kind === 'glassDoor' || content.kind === 'doubleDoor') && (
        <Stepper
          label="Étagères intérieures"
          value={content.shelves ?? 0}
          min={0}
          max={MAX_SHELVES}
          onChange={(shelves) => update({ ...content, shelves })}
        />
      )}
    </>
  )
}

const SIZE_LABELS: Record<Axis, { size: string; even: string }> = {
  x: { size: 'Largeur', even: 'Égaliser les colonnes' },
  y: { size: 'Hauteur', even: 'Égaliser les rangées' },
}

const SizeRow = ({ furniture, cell, axis }: { furniture: ParametricFurniture; cell: Cell; axis: Axis }) => {
  const builder = useBuilderLayout()
  const edit = useBuilderStore((state) => state.edit)
  const slot = sizeSlot(furniture, cell.id, axis)
  const length = axis === 'x' ? cell.rect.w : cell.rect.h
  const labels = SIZE_LABELS[axis]

  if (!slot || !builder) {
    return (
      <div className="flex items-center justify-between text-sm text-stone-700">
        {labels.size}
        <span className="text-xs text-stone-500">toute la {labels.size.toLowerCase()} intérieure</span>
      </div>
    )
  }

  const slotLength = builder.layout.splitLengths[slot.split.id]?.[slot.index] ?? length
  const isFixed = slot.split.sizes[slot.index].mode === 'fixed'
  const setFixed = (fixed: boolean) =>
    edit((current) => {
      const currentSlot = sizeSlot(current, cell.id, axis)
      if (!currentSlot) return current
      return fixed ? setChildLength(current, builder.layout, currentSlot, slotLength) : setChildAuto(current, builder.layout, currentSlot)
    })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm text-stone-700">
        {labels.size}
        <div className="flex items-center gap-1.5">
          <div role="group" aria-label={`Mode de ${labels.size.toLowerCase()}`} className="flex rounded-lg bg-stone-100 p-0.5">
            {[false, true].map((fixed) => (
              <button
                key={String(fixed)}
                type="button"
                aria-pressed={isFixed === fixed}
                title={fixed ? 'Garde cette taille quand le meuble change de dimensions' : "S'adapte aux dimensions du meuble"}
                onClick={() => isFixed !== fixed && setFixed(fixed)}
                className={`rounded-md px-2 py-0.5 text-xs ${isFixed === fixed ? 'bg-white text-accent shadow-sm' : 'text-stone-500'}`}
              >
                {fixed ? 'Fixe' : 'Auto'}
              </button>
            ))}
          </div>
          <CmInput
            value={slotLength}
            label={`${labels.size} en centimètres`}
            onCommit={(mm) =>
              edit((current) => {
                const currentSlot = sizeSlot(current, cell.id, axis)
                return currentSlot ? setChildLength(current, builder.layout, currentSlot, mm) : current
              })
            }
          />
        </div>
      </div>
      {slot.split.children.length > 1 && (
        <button type="button" onClick={() => edit((current) => distributeEvenly(current, slot.split.id))} className="self-end text-xs text-accent hover:underline">
          {labels.even}
        </button>
      )}
    </div>
  )
}

const Structure = ({ furniture, cell }: { furniture: ParametricFurniture; cell: Cell }) => {
  const builder = useBuilderLayout()
  const edit = useBuilderStore((state) => state.edit)
  const selectCell = useBuilderStore((state) => state.selectCell)
  const minSplit = MIN_COMPARTMENT * 2 + furniture.panelThickness
  const canMerge = (pathTo(furniture.root, cell.id)?.length ?? 0) > 0
  if (!builder) return null

  const split = (axis: Axis) => edit((current) => splitCell(current, builder.layout, cell.id, axis).furniture)
  const merge = () => {
    const result = mergeCell(furniture, builder.layout, cell.id)
    if (!result) return
    edit(() => result.furniture)
    selectCell(result.keptId)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <button type="button" className={actionClass} disabled={cell.rect.w < minSplit} onClick={() => split('x')}>
          <Columns2 size={16} /> 2 colonnes
        </button>
        <button type="button" className={actionClass} disabled={cell.rect.h < minSplit} onClick={() => split('y')}>
          <Rows2 size={16} /> 2 rangées
        </button>
      </div>
      <button type="button" className={actionClass} disabled={!canMerge} onClick={merge} title="Supprime la séparation avec le compartiment voisin">
        <Combine size={16} /> Fusionner avec le voisin
      </button>
    </div>
  )
}

const FALLBACK_COLOR = '#c8a97e'

const CellColor = ({ furniture, cell }: { furniture: ParametricFurniture; cell: Cell }) => {
  const materialColor = usePlannerStore((state) => state.materials[furniture.materialId]?.colorHex) ?? FALLBACK_COLOR
  return (
    <ColorField
      label="Couleur du compartiment"
      resetLabel="Par défaut"
      resetColor={furniture.frontColor ?? furniture.color ?? materialColor}
      value={cell.color}
      gestureKey={`cell:${cell.id}`}
      apply={(current, color) => setCellColor(current, cell.id, color)}
    />
  )
}

const EmptyState = () => (
  <div className="flex flex-col items-center gap-3 p-6 text-center text-sm text-stone-500">
    <MousePointerClick size={28} className="text-stone-400" />
    <p>Cliquez sur un compartiment du meuble pour choisir son contenu, le diviser ou le redimensionner.</p>
    <ul className="flex flex-col gap-2 text-left text-xs">
      <li className="flex items-center gap-2">
        <StretchHorizontal size={14} className="shrink-0 text-accent" /> Glissez une séparation pour la déplacer
      </li>
      <li className="flex items-center gap-2">
        <StretchVertical size={14} className="shrink-0 text-accent" /> Les cotes se saisissent en centimètres
      </li>
    </ul>
  </div>
)

/** Contextual settings of the selected compartment. */
export const CellPanel = () => {
  const builder = useBuilderLayout()
  const selectedCellId = useBuilderStore((state) => state.selectedCellId)
  const cell = builder?.layout.cells.find((candidate) => candidate.id === selectedCellId)
  if (!builder || !cell) return <EmptyState />

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4">
        <h2 className="text-sm font-semibold">Compartiment</h2>
        <p className="text-xs text-stone-500">{formatDimensions(cell.rect.w, cell.rect.h, builder.furniture.depth - builder.layout.backZ)}</p>
      </div>
      <Section title="Contenu">
        <ContentPicker cell={cell} />
      </Section>
      <Section title="Couleur">
        <CellColor furniture={builder.furniture} cell={cell} />
      </Section>
      <Section title="Découpe">
        <Structure furniture={builder.furniture} cell={cell} />
      </Section>
      <Section title="Taille">
        <SizeRow furniture={builder.furniture} cell={cell} axis="x" />
        <SizeRow furniture={builder.furniture} cell={cell} axis="y" />
      </Section>
    </div>
  )
}
