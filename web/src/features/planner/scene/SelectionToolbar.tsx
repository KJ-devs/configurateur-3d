import { Html } from '@react-three/drei'
import { Copy, Palette, RotateCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { RoomDto } from '../../../api/generated/model'
import { mmToM } from '../../../lib/units'
import { footprintBounds, unionBounds } from '../../../planner/collision'
import { toFootprints } from '../../../planner/editing'
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
  const [isColorOpen, setIsColorOpen] = useState(false)

  const selected = room.instances.filter((instance) => selectedIds.includes(instance.id))
  const footprints = toFootprints(selected, (instance) => models[instance.furnitureModelId])
  if (footprints.length === 0 || isDragging) return null

  const bounds = unionBounds(footprints.map(footprintBounds))
  const tallest = Math.max(...selected.map((instance) => models[instance.furnitureModelId]?.height ?? 0))
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
