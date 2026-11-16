import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { FurnitureInstanceDto, RoomDto } from '../../../api/generated/model'
import { mmToM } from '../../../lib/units'
import { clampToBounds, footprintHalfExtents, polygonBounds, type Point } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'
import { rayToFloor } from './floorPlane'
import { furnitureColor } from './furnitureColor'

const DEG_TO_RAD = Math.PI / 180
const EDGE_COLOR = '#57534e'
const SELECTION_COLOR = '#2f6f5e'
const SELECTION_LINE_WIDTH = 3
const HALO_MARGIN = 0.06
const HALO_HEIGHT = 0.004
const ignoreRaycast = () => null
const LEFT_BUTTON = 0

type Props = { instance: FurnitureInstanceDto; room: RoomDto }

export const FurnitureItem = ({ instance, room }: Props) => {
  const model = usePlannerStore((state) => state.models[instance.furnitureModelId])
  const materials = usePlannerStore((state) => state.materials)
  const isSelected = usePlannerStore((state) => state.selectedIds.includes(instance.id))
  const viewMode = usePlannerStore((state) => state.viewMode)
  const select = usePlannerStore((state) => state.select)
  const moveInstance = usePlannerStore((state) => state.moveInstance)
  const setDragging = usePlannerStore((state) => state.setDragging)
  const grabOffset = useRef<Point | null>(null)

  if (!model) return null

  const width = mmToM(model.width)
  const height = mmToM(model.height)
  const depth = mmToM(model.depth)

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== LEFT_BUTTON) return
    event.stopPropagation()
    select(instance.id)

    const floorPoint = rayToFloor(event.ray)
    if (!floorPoint) return
    grabOffset.current = { x: instance.x - floorPoint.x, z: instance.z - floorPoint.z }
    ;(event.target as Element).setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const floorPoint = rayToFloor(event.ray)
    if (!grabOffset.current || !floorPoint) return
    event.stopPropagation()

    const { halfX, halfZ } = footprintHalfExtents(model.width, model.depth, instance.rotationY)
    const target = { x: floorPoint.x + grabOffset.current.x, z: floorPoint.z + grabOffset.current.z }
    moveInstance(instance.id, clampToBounds(target, halfX, halfZ, polygonBounds(room.floorPolygon)))
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!grabOffset.current) return
    grabOffset.current = null
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    setDragging(false)
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
        <meshStandardMaterial color={furnitureColor(model, materials, instance)} />
        <Edges color={isSelected ? SELECTION_COLOR : EDGE_COLOR} lineWidth={isSelected ? SELECTION_LINE_WIDTH : 1} />
      </mesh>

      {isSelected && (
        <mesh position-y={HALO_HEIGHT} rotation-x={-Math.PI / 2} raycast={ignoreRaycast}>
          <planeGeometry args={[width + HALO_MARGIN * 2, depth + HALO_MARGIN * 2]} />
          <meshBasicMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      )}

      {viewMode === '2d' && (
        <Html center position={[0, height, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <span className="whitespace-nowrap rounded bg-white/80 px-1.5 py-0.5 text-[11px] font-medium text-stone-700">
            {model.name}
          </span>
        </Html>
      )}
    </group>
  )
}
