import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { FlipHorizontal2, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import type { OpeningDto, RoomDto } from '../../../api/generated/model'
import { mmToM } from '../../../lib/units'
import type { Point, Wall } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'
import { FloorLine } from './FloorLine'
import { rayToFloor } from './floorPlane'

const DOOR_COLOR = '#b08968'
const GLASS_COLOR = '#bfdbfe'
const SELECTION_COLOR = '#2f6f5e'
const SWING_COLOR = '#78716c'
const EDGE_COLOR = '#57534e'
const LEAF_THICKNESS = 0.04
const SWING_STEPS = 10
const LEFT_BUTTON = 0
const WIDTH_OPTIONS_CM = { Door: [63, 73, 83, 93], Window: [60, 80, 100, 120, 140, 180] }
const MM_PER_CM = 10

type Props = { opening: OpeningDto; wall: Wall; room: RoomDto }

/** Quarter circle swept by a door leaf, drawn on the floor inside the room. */
const DoorSwing = ({ opening, wall }: { opening: OpeningDto; wall: Wall }) => {
  const direction = { x: (wall.end.x - wall.start.x) / wall.length, z: (wall.end.z - wall.start.z) / wall.length }
  const isLeftHinge = opening.hingeSide !== 'Right'
  const hingeAlong = isLeftHinge ? opening.offset : opening.offset + opening.width
  const hinge = { x: wall.start.x + direction.x * hingeAlong, z: wall.start.z + direction.z * hingeAlong }
  const closedSign = isLeftHinge ? 1 : -1

  const arc: Point[] = Array.from({ length: SWING_STEPS + 1 }, (_, step) => {
    const angle = (step / SWING_STEPS) * (Math.PI / 2)
    const along = Math.cos(angle) * opening.width * closedSign
    const inward = Math.sin(angle) * opening.width
    return { x: hinge.x + direction.x * along - wall.normal.x * inward, z: hinge.z + direction.z * along - wall.normal.z * inward }
  })

  return (
    <>
      {arc.slice(1).map((point, index) => (
        <FloorLine key={index} from={arc[index]} to={point} color={SWING_COLOR} width={0.008} />
      ))}
      <FloorLine from={hinge} to={arc[SWING_STEPS]} color={SWING_COLOR} width={0.02} />
    </>
  )
}

const OpeningToolbar = ({ opening }: { opening: OpeningDto }) => {
  const updateSelectedOpening = usePlannerStore((state) => state.updateSelectedOpening)
  const deleteSelected = usePlannerStore((state) => state.deleteSelected)
  const buttonClass = 'rounded-md p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900'

  return (
    <div role="toolbar" aria-label="Actions sur l'ouverture" className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
      <select
        value={opening.width}
        aria-label="Largeur"
        onChange={(event) => updateSelectedOpening({ width: Number(event.target.value) })}
        className="rounded-md border border-stone-200 bg-white px-1.5 py-1 text-xs text-stone-700 outline-none"
      >
        {[...new Set([...WIDTH_OPTIONS_CM[opening.kind].map((cm) => cm * MM_PER_CM), opening.width])]
          .sort((a, b) => a - b)
          .map((width) => (
            <option key={width} value={width}>
              {width / MM_PER_CM} cm
            </option>
          ))}
      </select>
      {opening.kind === 'Door' && (
        <button
          type="button"
          className={buttonClass}
          title="Inverser le sens d'ouverture"
          aria-label="Inverser le sens d'ouverture"
          onClick={() => updateSelectedOpening({ hingeSide: opening.hingeSide === 'Right' ? 'Left' : 'Right' })}
        >
          <FlipHorizontal2 size={16} />
        </button>
      )}
      <button type="button" className={`${buttonClass} hover:text-red-600`} title="Supprimer (Suppr)" aria-label="Supprimer" onClick={deleteSelected}>
        <Trash2 size={16} />
      </button>
    </div>
  )
}

/** Door or window clipped into its wall: click to select, drag to slide it along the walls. */
export const OpeningItem = ({ opening, wall, room }: Props) => {
  const isSelected = usePlannerStore((state) => state.selectedOpeningId === opening.id)
  const isDragging = usePlannerStore((state) => state.isDragging)
  const isMoving = useRef(false)
  const isDoor = opening.kind === 'Door'
  const width = mmToM(opening.width)
  const height = mmToM(opening.height)
  const thickness = mmToM(room.wallThickness)
  const centerY = mmToM(opening.sillHeight) + height / 2

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== LEFT_BUTTON) return
    event.stopPropagation()
    isMoving.current = true
    ;(event.target as Element).setPointerCapture(event.pointerId)
    usePlannerStore.getState().selectOpening(opening.id)
    usePlannerStore.getState().beginDrag(isDoor ? 'Déplacer la porte' : 'Déplacer la fenêtre')
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const floor = rayToFloor(event.ray)
    if (!isMoving.current || !floor) return
    event.stopPropagation()
    usePlannerStore.getState().dragOpeningTo(opening.id, floor)
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!isMoving.current) return
    isMoving.current = false
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    usePlannerStore.getState().endDrag()
  }

  return (
    <>
      <group position={[mmToM(wall.start.x), 0, mmToM(wall.start.z)]} rotation-y={wall.rotationY}>
        <mesh
          position={[mmToM(opening.offset) + width / 2, centerY, (-wall.inwardZ * thickness) / 2]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerOver={() => (document.body.style.cursor = 'ew-resize')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          <boxGeometry args={[width, height, isDoor ? LEAF_THICKNESS : thickness * 0.3]} />
          <meshStandardMaterial color={isDoor ? DOOR_COLOR : GLASS_COLOR} transparent opacity={isDoor ? 1 : 0.55} />
          <Edges color={isSelected ? SELECTION_COLOR : EDGE_COLOR} lineWidth={isSelected ? 3 : 1} />
        </mesh>

        {isSelected && !isDragging && (
          <Html center position={[mmToM(opening.offset) + width / 2, mmToM(opening.sillHeight) + height + 0.3, 0]} zIndexRange={[40, 30]}>
            <OpeningToolbar opening={opening} />
          </Html>
        )}
      </group>
      {isDoor && <DoorSwing opening={opening} wall={wall} />}
    </>
  )
}
