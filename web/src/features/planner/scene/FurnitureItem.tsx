import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { FurnitureInstanceDto, RoomDto } from '../../../api/generated/model'
import { definitionOf, dimensionsOf } from '../../../engine/furniture'
import { mmToM } from '../../../lib/units'
import { ParametricMesh } from '../../furniture/ParametricMesh'
import type { Point } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'
import { rayToFloor } from './floorPlane'
import { furnitureColor } from './furnitureColor'
import { RotationHandle } from './RotationHandle'

const DEG_TO_RAD = Math.PI / 180
const EDGE_COLOR = '#57534e'
const SELECTION_COLOR = '#2f6f5e'
const COLLISION_COLOR = '#dc2626'
const SELECTION_LINE_WIDTH = 3
const HALO_MARGIN = 0.06
const HALO_HEIGHT = 0.004
const LEFT_BUTTON = 0
const DRAG_START_DISTANCE_PX = 4
const ignoreRaycast = () => null

type DragStart = { floor: Point; clientX: number; clientY: number; hasMoved: boolean }
type Props = { instance: FurnitureInstanceDto; room: RoomDto; isColliding: boolean }

export const FurnitureItem = ({ instance, room, isColliding }: Props) => {
  const model = usePlannerStore((state) => state.models[instance.furnitureModelId])
  const materials = usePlannerStore((state) => state.materials)
  const isSelected = usePlannerStore((state) => state.selectedIds.includes(instance.id))
  const isOnlySelection = usePlannerStore((state) => state.selectedIds.length === 1 && state.selectedIds[0] === instance.id)
  const viewMode = usePlannerStore((state) => state.viewMode)
  const dragStart = useRef<DragStart | null>(null)

  const definition = definitionOf(model, instance)
  const size = dimensionsOf(model, instance)
  if (!model || !size) return null

  const width = mmToM(size.width)
  const height = mmToM(size.height)
  const depth = mmToM(size.depth)
  const isTooTall = size.height > room.ceilingHeight
  const color = furnitureColor(model, materials, instance, definition)
  const isHighlighted = isSelected || isColliding
  const highlightColor = isColliding ? COLLISION_COLOR : SELECTION_COLOR

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== LEFT_BUTTON) return
    event.stopPropagation()

    const { select, selectedIds } = usePlannerStore.getState()
    if (event.shiftKey) return select(instance.id, true)
    if (!selectedIds.includes(instance.id)) select(instance.id)

    const floor = rayToFloor(event.ray)
    if (!floor) return
    dragStart.current = { floor, clientX: event.clientX, clientY: event.clientY, hasMoved: false }
    ;(event.target as Element).setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const start = dragStart.current
    const floor = rayToFloor(event.ray)
    if (!start || !floor) return
    event.stopPropagation()

    const { beginDrag, dragSelectionBy } = usePlannerStore.getState()
    if (!start.hasMoved) {
      if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < DRAG_START_DISTANCE_PX) return
      start.hasMoved = true
      beginDrag('Déplacer')
    }
    dragSelectionBy({ x: floor.x - start.floor.x, z: floor.z - start.floor.z }, !event.altKey)
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = dragStart.current
    if (!start) return
    dragStart.current = null
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    if (start.hasMoved) usePlannerStore.getState().endDrag()
  }

  return (
    <group position={[mmToM(instance.x), 0, mmToM(instance.z)]} rotation-y={instance.rotationY * DEG_TO_RAD}>
      <mesh
        position-y={height / 2}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={() => (document.body.style.cursor = 'grab')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <boxGeometry args={[width, height, depth]} />
        {definition ? (
          // The detailed panels below are drawn instead; this box only catches the pointer.
          <meshBasicMaterial visible={false} />
        ) : (
          <meshStandardMaterial
            color={color}
            emissive={isColliding ? COLLISION_COLOR : '#000000'}
            emissiveIntensity={isColliding ? 0.45 : 0}
          />
        )}
        {(!definition || isHighlighted) && (
          <Edges color={isHighlighted ? highlightColor : EDGE_COLOR} lineWidth={isHighlighted ? SELECTION_LINE_WIDTH : 1} />
        )}
      </mesh>

      {definition && (
        <group position={[-width / 2, 0, -depth / 2]}>
          <ParametricMesh furniture={definition} color={color} emissive={isColliding ? COLLISION_COLOR : undefined} />
        </group>
      )}

      {isSelected && (
        <mesh position-y={HALO_HEIGHT} rotation-x={-Math.PI / 2} raycast={ignoreRaycast}>
          <planeGeometry args={[width + HALO_MARGIN * 2, depth + HALO_MARGIN * 2]} />
          <meshBasicMaterial color={highlightColor} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      )}

      {isOnlySelection && <RotationHandle instance={instance} depth={depth} />}

      {(viewMode === '2d' || isTooTall) && (
        <Html center position={[0, height, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center gap-0.5 whitespace-nowrap text-[11px] font-medium">
            {viewMode === '2d' && <span className="rounded bg-white/80 px-1.5 py-0.5 text-stone-700">{model.name}</span>}
            {isTooTall && <span className="rounded bg-amber-500 px-1.5 py-0.5 text-white">Dépasse la hauteur sous plafond</span>}
          </div>
        </Html>
      )}
    </group>
  )
}
