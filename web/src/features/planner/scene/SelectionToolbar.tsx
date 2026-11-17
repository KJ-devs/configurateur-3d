import { Html } from '@react-three/drei'
import { Copy, Palette, PencilRuler, RotateCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { FurnitureInstanceDto, RoomDto } from '../../../api/generated/model'
import { dimensionsOf } from '../../../engine/furniture'
import { mmToM } from '../../../lib/units'
import { footprintBounds, unionBounds } from '../../../planner/collision'
import { toFootprints } from '../../../planner/editing'
import { useBuilderStore } from '../../../store/builderStore'
import { usePlannerStore } from '../../../store/plannerStore'

const TOOLBAR_GAP = 0.3
const EXTRA_COLORS = ['#ffffff', '#9ca3af', '#1f2937', '#b45309', '#1d4ed8', '#be123c']

const buttonClass = 'rounded-md p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900'

const ColorSwatches = () => {
  const materials = usePlannerStore((state) => state.materials)
  const setSelectedColor = usePlannerStore((state) => state.setSelectedColor)
  const materialColors = Object.values(materials)
    .filter((material) => material.kind === 'Wood' || material.kind === 'Lacquer')
    .map((material) => ({ color: material.colorHex, label: material.name }))
  const swatches = [...materialColors, ...EXTRA_COLORS.map((color) => ({ color, label: color }))]

  return (
    <div className="absolute left-1/2 top-full mt-1 flex w-44 -translate-x-1/2 flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
      {swatches.map(({ color, label }) => (
        <button
          key={color}
          type="button"
          title={label}
          aria-label={`Couleur ${label}`}
          onClick={() => setSelectedColor(color)}
          className="h-6 w-6 rounded-full ring-1 ring-black/15 hover:scale-110"
          style={{ backgroundColor: color }}
        />
      ))}
      <button
        type="button"
        onClick={() => setSelectedColor(null)}
        className="w-full rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
      >
        Couleur d'origine
      </button>
    </div>
  )
}

type Props = { room: RoomDto }

/** Floating actions shown above the current selection. */
export const SelectionToolbar = ({ room }: Props) => {
  const selectedIds = usePlannerStore((state) => state.selectedIds)
  const models = usePlannerStore((state) => state.models)
  const viewMode = usePlannerStore((state) => state.viewMode)
  const isDragging = usePlannerStore((state) => state.isDragging)
  const rotateSelected = usePlannerStore((state) => state.rotateSelected)
  const duplicateSelected = usePlannerStore((state) => state.duplicateSelected)
  const deleteSelected = usePlannerStore((state) => state.deleteSelected)
  const openBuilder = useBuilderStore((state) => state.open)
  const [isColorOpen, setIsColorOpen] = useState(false)

  const selected = room.instances.filter((instance) => selectedIds.includes(instance.id))
  const sizeOf = (instance: FurnitureInstanceDto) => dimensionsOf(models[instance.furnitureModelId], instance)
  const footprints = toFootprints(selected, sizeOf)
  if (footprints.length === 0 || isDragging) return null

  const bounds = unionBounds(footprints.map(footprintBounds))
  const tallest = Math.max(...selected.map((instance) => sizeOf(instance)?.height ?? 0))
  const customisable = selected.length === 1 && models[selected[0].furnitureModelId]?.type === 'Parametric' ? selected[0] : undefined
  const centerX = mmToM((bounds.minX + bounds.maxX) / 2)
  // Seen from above the toolbar would cover the furniture: push it past the far edge instead.
  const position: [number, number, number] =
    viewMode === '2d'
      ? [centerX, mmToM(tallest), mmToM(bounds.minZ) - TOOLBAR_GAP]
      : [centerX, mmToM(tallest) + TOOLBAR_GAP, mmToM((bounds.minZ + bounds.maxZ) / 2)]

  return (
    <Html center position={position} zIndexRange={[40, 30]}>
      <div
        role="toolbar"
        aria-label="Actions sur la sélection"
        className="relative flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-1 shadow-lg"
      >
        {customisable && (
          <button
            type="button"
            className={`${buttonClass} flex items-center gap-1 pr-2 font-medium text-accent`}
            title="Modifier les dimensions, les compartiments et la finition"
            onClick={() => openBuilder({ kind: 'instance', instanceId: customisable.id })}
          >
            <PencilRuler size={16} />
            <span className="text-xs">Personnaliser</span>
          </button>
        )}
        <button type="button" className={buttonClass} title="Tourner de 90° (R)" aria-label="Tourner de 90°" onClick={() => rotateSelected(90)}>
          <RotateCw size={16} />
        </button>
        <button type="button" className={buttonClass} title="Dupliquer (Ctrl+D)" aria-label="Dupliquer" onClick={duplicateSelected}>
          <Copy size={16} />
        </button>
        <button
          type="button"
          className={buttonClass}
          title="Changer de couleur"
          aria-label="Changer de couleur"
          aria-expanded={isColorOpen}
          onClick={() => setIsColorOpen(!isColorOpen)}
        >
          <Palette size={16} />
        </button>
        <button type="button" className={`${buttonClass} hover:text-red-600`} title="Supprimer (Suppr)" aria-label="Supprimer" onClick={deleteSelected}>
          <Trash2 size={16} />
        </button>
        {isColorOpen && <ColorSwatches />}
      </div>
    </Html>
  )
}
