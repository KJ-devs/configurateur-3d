import { Html } from '@react-three/drei'
import { useState, type KeyboardEvent } from 'react'
import type { FurnitureInstanceDto, RoomDto } from '../../../api/generated/model'
import { formatCm, mmToM } from '../../../lib/units'
import { centerForWallDistance, wallDistances, type WallDistance } from '../../../planner/dimensions'
import { footprintHalfExtents } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'
import { FloorLine } from './FloorLine'

const DIMENSION_COLOR = '#0369a1'
const MIN_VISIBLE_DISTANCE = 5
const MM_PER_CM = 10
const LABEL_ELEVATION = 0.03

type LabelProps = { instance: FurnitureInstanceDto; dimension: WallDistance; isInteractive: boolean }

/** Distance label: click it and type a value in cm to place the furniture exactly. */
const DimensionLabel = ({ instance, dimension, isInteractive }: LabelProps) => {
  const placeInstance = usePlannerStore((state) => state.placeInstance)
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    const centimetres = Number(draft?.replace(',', '.'))
    if (draft !== null && draft.trim() !== '' && Number.isFinite(centimetres) && centimetres >= 0) {
      const center = { x: instance.x, z: instance.z }
      placeInstance(instance.id, centerForWallDistance(center, dimension, centimetres * MM_PER_CM))
    }
    setDraft(null)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') setDraft(null)
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        value={draft}
        aria-label="Distance au mur en centimètres"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onFocus={(event) => event.target.select()}
        className="w-16 rounded border border-sky-600 bg-white px-1 py-0.5 text-center text-xs outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      disabled={!isInteractive}
      title="Cliquer pour saisir une distance exacte"
      onClick={() => setDraft(String(Math.round(dimension.distance) / MM_PER_CM).replace('.', ','))}
      className="whitespace-nowrap rounded bg-sky-700 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm enabled:hover:bg-sky-600"
    >
      {formatCm(dimension.distance)}
    </button>
  )
}

type Props = { instance: FurnitureInstanceDto; room: RoomDto }

/** Live distances between the selected furniture and the walls around it. */
export const DimensionLines = ({ instance, room }: Props) => {
  const model = usePlannerStore((state) => state.models[instance.furnitureModelId])
  const isDragging = usePlannerStore((state) => state.isDragging)
  if (!model) return null

  const { halfX, halfZ } = footprintHalfExtents(model.width, model.depth, instance.rotationY)
  const dimensions = wallDistances({ x: instance.x, z: instance.z }, halfX, halfZ, room.floorPolygon).filter(
    (dimension) => dimension.distance >= MIN_VISIBLE_DISTANCE,
  )

  return dimensions.map((dimension) => (
    <group key={dimension.direction}>
      <FloorLine from={dimension.from} to={dimension.to} color={DIMENSION_COLOR} />
      <Html
        center
        position={[mmToM((dimension.from.x + dimension.to.x) / 2), LABEL_ELEVATION, mmToM((dimension.from.z + dimension.to.z) / 2)]}
        zIndexRange={[30, 20]}
        style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
      >
        <DimensionLabel instance={instance} dimension={dimension} isInteractive={!isDragging} />
      </Html>
    </group>
  ))
}
