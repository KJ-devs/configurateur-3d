import { Html } from '@react-three/drei'
import { Copy, EyeOff, Sofa, Trash2 } from 'lucide-react'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { DoubleSide, Shape } from 'three'
import type { FurnitureInstanceDto, RoomDto } from '../../../api/generated/model'
import { definitionOf, dimensionsOf } from '../../../engine/furniture'
import { mmToM } from '../../../lib/units'
import { boundsCenter, polygonArea, polygonBounds, type Point } from '../../../planner/geometry'
import { planExtent } from '../../../planner/plan'
import { usePlannerStore } from '../../../store/plannerStore'
import { ParametricMesh } from '../../furniture/ParametricMesh'
import { CameraRig } from './CameraRig'
import { rayToFloor } from './floorPlane'
import { furnitureColor } from './furnitureColor'
import { RoomMesh } from './RoomMesh'
import { WallControls } from './WallControls'

const ACCENT = '#2f6f5e'
const DEG_TO_RAD = Math.PI / 180
const MM2_PER_M2 = 1_000_000
const PICKER_ELEVATION = 0.004
const LEFT_BUTTON = 0
const DRAG_START_DISTANCE_PX = 4
const ignoreRaycast = () => null

/** A placed piece of furniture, drawn only: on the overall plan rooms move as a whole. */
const StaticFurniture = ({ instance }: { instance: FurnitureInstanceDto }) => {
  const model = usePlannerStore((state) => state.models[instance.furnitureModelId])
  const materials = usePlannerStore((state) => state.materials)
  const size = dimensionsOf(model, instance)
  if (!model || !size) return null

  const definition = definitionOf(model, instance)
  const color = furnitureColor(model, materials, instance, definition)
  const [width, height, depth] = [mmToM(size.width), mmToM(size.height), mmToM(size.depth)]
  return (
    <group position={[mmToM(instance.x), 0, mmToM(instance.z)]} rotation-y={instance.rotationY * DEG_TO_RAD}>
      {definition ? (
        <group position={[-width / 2, 0, -depth / 2]}>
          <ParametricMesh furniture={definition} color={color} />
        </group>
      ) : (
        <mesh position-y={height / 2} raycast={ignoreRaycast}>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}

type DragStart = { floor: Point; clientX: number; clientY: number; hasMoved: boolean }

const CLICK_MAX_DISTANCE_PX = 4
const TOOLBAR_OFFSET = 700

type PlacedRoomProps = {
  room: RoomDto
  /** Where the room is drawn in the scene, in mm. */
  origin: Point
  /** On the overall plan rooms can be dragged; around an open room they can only be clicked to open them. */
  isMovable: boolean
}

/** A whole room drawn as one block, with its furniture: click it to open it, drag it when movable. */
export const PlacedRoomView = ({ room, origin, isMovable }: PlacedRoomProps) => {
  const isActive = usePlannerStore((state) => state.activeRoomId === room.id)
  const [isHovered, setIsHovered] = useState(false)
  const dragStart = useRef<DragStart | null>(null)
  const center = boundsCenter(polygonBounds(room.floorPolygon))
  const area = (polygonArea(room.floorPolygon) / MM2_PER_M2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })

  const floorShape = useMemo(() => {
    const shape = new Shape()
    room.floorPolygon.forEach((point, index) =>
      index === 0 ? shape.moveTo(mmToM(point.x), mmToM(point.z)) : shape.lineTo(mmToM(point.x), mmToM(point.z)),
    )
    shape.closePath()
    return shape
  }, [room.floorPolygon])

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== LEFT_BUTTON) return
    event.stopPropagation()
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

    const planner = usePlannerStore.getState()
    if (!start.hasMoved) {
      if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < DRAG_START_DISTANCE_PX) return
      start.hasMoved = true
      planner.beginRoomMove(room.id)
      document.body.style.cursor = 'grabbing'
    }
    planner.dragRoomBy({ x: floor.x - start.floor.x, z: floor.z - start.floor.z })
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = dragStart.current
    if (!start) return
    dragStart.current = null
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    document.body.style.cursor = isHovered ? 'grab' : 'auto'
    // A click selects the room (to resize it or use its toolbar); a double click opens it.
    if (start.hasMoved) usePlannerStore.getState().endRoomMove()
    else usePlannerStore.getState().setActiveRoom(room.id)
  }

  const isSelected = isMovable && isActive
  const tint = isHovered ? 0.16 : isSelected ? 0.12 : 0
  return (
    <group position={[mmToM(origin.x), 0, mmToM(origin.z)]}>
      <RoomMesh room={room} origin={origin} />
      {room.instances.map((instance) => (
        <StaticFurniture key={instance.id} instance={instance} />
      ))}
      <mesh
        rotation-x={Math.PI / 2}
        position-y={PICKER_ELEVATION}
        onPointerDown={isMovable ? handlePointerDown : undefined}
        onPointerMove={isMovable ? handlePointerMove : undefined}
        onPointerUp={isMovable ? handlePointerUp : undefined}
        onClick={(event) => {
          if (isMovable || event.delta > CLICK_MAX_DISTANCE_PX) return
          event.stopPropagation()
          usePlannerStore.getState().openRoom(room.id)
        }}
        onDoubleClick={(event) => {
          event.stopPropagation()
          usePlannerStore.getState().openRoom(room.id)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setIsHovered(true)
          if (!dragStart.current) document.body.style.cursor = isMovable ? 'grab' : 'pointer'
        }}
        onPointerOut={() => {
          setIsHovered(false)
          if (!dragStart.current) document.body.style.cursor = 'auto'
        }}
      >
        <shapeGeometry args={[floorShape]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={tint} side={DoubleSide} depthWrite={false} />
      </mesh>
      <Html center position={[mmToM(center.x), 0.05, mmToM(center.z)]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
        <span
          className={`flex flex-col items-center whitespace-nowrap rounded-lg px-2 py-1 text-center shadow-sm ${
            isHovered || isSelected ? 'bg-accent text-white' : 'bg-white/90 text-stone-800'
          }`}
        >
          <span className="text-xs font-semibold">{room.name}</span>
          <span className={`text-[10px] ${isHovered || isSelected ? 'text-white/80' : 'text-stone-500'}`}>{area} m²</span>
        </span>
      </Html>
      {isSelected && (
        <>
          <WallControls room={room} />
          <RoomToolbar room={room} />
        </>
      )}
    </group>
  )
}

const toolbarButtonClass = 'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-100 hover:text-stone-900'

/** Actions on the room selected on the overall plan, floating above its far wall. */
const RoomToolbar = ({ room }: { room: RoomDto }) => {
  const viewMode = usePlannerStore((state) => state.viewMode)
  const isDragging = usePlannerStore((state) => state.isDragging)
  const { openRoom, duplicateRoom, setRoomHidden, deleteRoom } = usePlannerStore.getState()
  if (isDragging) return null

  const bounds = polygonBounds(room.floorPolygon)
  const x = mmToM((bounds.minX + bounds.maxX) / 2)
  // Seen from above the toolbar sits beyond the far wall; in 3D it floats over the room.
  const position: [number, number, number] =
    viewMode === '2d'
      ? [x, 0.05, mmToM(bounds.minZ - room.wallThickness - TOOLBAR_OFFSET)]
      : [x, mmToM(room.ceilingHeight) + 0.3, mmToM((bounds.minZ + bounds.maxZ) / 2)]

  const handleDelete = () => {
    if (window.confirm(`Supprimer la pièce « ${room.name} » et ses meubles ?`)) void deleteRoom(room.id)
  }

  return (
    <Html center position={position} zIndexRange={[40, 30]}>
      <div role="toolbar" aria-label={`Actions sur ${room.name}`} className="flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
        <button
          type="button"
          onClick={() => openRoom(room.id)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:brightness-110"
        >
          <Sofa size={14} /> Aménager
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => void duplicateRoom(room.id)} title="Dupliquer la pièce">
          <Copy size={14} /> Dupliquer
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => setRoomHidden(room.id, true)} title="Masquer du plan d'ensemble">
          <EyeOff size={14} /> Masquer
        </button>
        <button type="button" className={`${toolbarButtonClass} hover:text-red-600`} onClick={handleDelete} aria-label="Supprimer la pièce" title="Supprimer la pièce">
          <Trash2 size={14} />
        </button>
      </div>
    </Html>
  )
}

/** Every visible room at its place on the overall plan: drag a room to arrange it, click it to furnish it. */
export const OverviewScene = () => {
  const rooms = usePlannerStore((state) => state.rooms)
  const visible = rooms.filter((room) => !room.isHidden)
  const extent = planExtent(visible)
  const outline: Point[] = extent
    ? [
        { x: extent.minX, z: extent.minZ },
        { x: extent.maxX, z: extent.minZ },
        { x: extent.maxX, z: extent.maxZ },
        { x: extent.minX, z: extent.maxZ },
      ]
    : []
  const ceilingHeight = Math.max(0, ...visible.map((room) => room.ceilingHeight))
  // Re-frame when the set of visible rooms changes, not while a room is dragged around.
  const frameKey = `overview:${visible.map((room) => room.id).join(',')}`

  return (
    <>
      {extent && <CameraRig frameKey={frameKey} outline={outline} ceilingHeight={ceilingHeight} />}
      {visible.map((room) => (
        <PlacedRoomView key={room.id} room={room} origin={{ x: room.positionX, z: room.positionZ }} isMovable />
      ))}
    </>
  )
}
