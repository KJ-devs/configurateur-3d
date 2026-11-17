import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { RoomDto } from '../../../api/generated/model'
import { formatCm, mmToM } from '../../../lib/units'
import { computeWalls, type Point, type Wall } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'
import { rayToFloor } from './floorPlane'

const ACCENT = '#2f6f5e'
const HANDLE_RADIUS = 0.12
const HANDLE_INSET = 260
const HANDLE_ELEVATION = 0.012
const LABEL_OUTSET = 260
const LABEL_ELEVATION = 0.03
const MM_PER_CM = 10
const LEFT_BUTTON = 0

const midpoint = (wall: Wall, outwards: number): Point => ({
  x: (wall.start.x + wall.end.x) / 2 + wall.normal.x * outwards,
  z: (wall.start.z + wall.end.z) / 2 + wall.normal.z * outwards,
})

type DragStart = { floor: Point; normal: Point }

/** Round grip inside the room near the middle of a wall: drag it to push or pull the wall. */
const WallHandle = ({ wall }: { wall: Wall }) => {
  const isActive = usePlannerStore((state) => state.draggedWall === wall.index)
  const [isHovered, setIsHovered] = useState(false)
  const dragStart = useRef<DragStart | null>(null)
  const position = midpoint(wall, -HANDLE_INSET)
  // The grip's bar points across the wall, the way it moves.
  const angle = Math.atan2(wall.normal.x, wall.normal.z)

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== LEFT_BUTTON) return
    event.stopPropagation()
    const floor = rayToFloor(event.ray)
    if (!floor) return
    dragStart.current = { floor, normal: wall.normal }
    ;(event.target as Element).setPointerCapture(event.pointerId)
    usePlannerStore.getState().beginWallDrag(wall.index)
    document.body.style.cursor = 'grabbing'
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const start = dragStart.current
    const floor = rayToFloor(event.ray)
    if (!start || !floor) return
    event.stopPropagation()
    const distance = (floor.x - start.floor.x) * start.normal.x + (floor.z - start.floor.z) * start.normal.z
    usePlannerStore.getState().dragWallBy(distance)
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!dragStart.current) return
    dragStart.current = null
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    usePlannerStore.getState().endWallDrag()
    document.body.style.cursor = isHovered ? 'grab' : 'auto'
  }

  const scale = isActive || isHovered ? 1.25 : 1
  return (
    <group position={[mmToM(position.x), HANDLE_ELEVATION, mmToM(position.z)]} rotation-y={angle} scale={scale}>
      <mesh
        rotation-x={-Math.PI / 2}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={(event) => {
          event.stopPropagation()
          setIsHovered(true)
          if (!dragStart.current) document.body.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          setIsHovered(false)
          if (!dragStart.current) document.body.style.cursor = 'auto'
        }}
      >
        <circleGeometry args={[HANDLE_RADIUS, 32]} />
        <meshBasicMaterial color={isActive || isHovered ? ACCENT : '#ffffff'} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} raycast={() => null}>
        <ringGeometry args={[HANDLE_RADIUS - 0.018, HANDLE_RADIUS, 32]} />
        <meshBasicMaterial color={ACCENT} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002} raycast={() => null}>
        <planeGeometry args={[0.022, HANDLE_RADIUS * 1.2]} />
        <meshBasicMaterial color={isActive || isHovered ? '#ffffff' : ACCENT} />
      </mesh>
    </group>
  )
}

/** Length of a wall, outside the room: click it and type a length in cm. */
const WallLength = ({ wall, wallThickness }: { wall: Wall; wallThickness: number }) => {
  const setWallLength = usePlannerStore((state) => state.setWallLength)
  const isDragging = usePlannerStore((state) => state.isDragging)
  const [draft, setDraft] = useState<string | null>(null)
  const position = midpoint(wall, wallThickness + LABEL_OUTSET)

  const commit = () => {
    const centimetres = Number(draft?.replace(',', '.'))
    if (draft !== null && draft.trim() !== '' && Number.isFinite(centimetres) && centimetres > 0) {
      setWallLength(wall.index, centimetres * MM_PER_CM)
    }
    setDraft(null)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') setDraft(null)
  }

  return (
    <Html
      center
      position={[mmToM(position.x), LABEL_ELEVATION, mmToM(position.z)]}
      zIndexRange={[25, 15]}
      style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
    >
      {draft !== null ? (
        <input
          autoFocus
          inputMode="decimal"
          value={draft}
          aria-label="Longueur du mur en centimètres"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onFocus={(event) => event.target.select()}
          className="w-20 rounded border border-stone-700 bg-white px-1 py-0.5 text-center text-xs outline-none"
        />
      ) : (
        <button
          type="button"
          title="Cliquer pour saisir la longueur du mur"
          onClick={() => setDraft(String(Math.round(wall.length) / MM_PER_CM).replace('.', ','))}
          className="whitespace-nowrap rounded bg-stone-800 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm hover:bg-accent"
        >
          {formatCm(wall.length)}
        </button>
      )}
    </Html>
  )
}

type Props = { room: RoomDto }

/**
 * Room resizing on the plan: wall lengths (2D, or while a wall moves) and grips to drag the walls,
 * shown when nothing is selected so they never get in the way of furniture editing.
 */
export const WallControls = ({ room }: Props) => {
  const viewMode = usePlannerStore((state) => state.viewMode)
  const draggedWall = usePlannerStore((state) => state.draggedWall)
  const hasSelection = usePlannerStore((state) => state.selectedIds.length > 0 || state.selectedOpeningId !== null)
  const isBusy = usePlannerStore((state) => state.ghost !== null || (state.isDragging && state.draggedWall === null))
  const walls = useMemo(() => computeWalls(room.floorPolygon, room.wallThickness), [room.floorPolygon, room.wallThickness])

  const showLengths = viewMode === '2d' || draggedWall !== null
  const showHandles = !hasSelection && !isBusy
  return (
    <>
      {showLengths && walls.map((wall) => <WallLength key={`length:${wall.index}`} wall={wall} wallThickness={room.wallThickness} />)}
      {showHandles && walls.map((wall) => <WallHandle key={`handle:${wall.index}`} wall={wall} />)}
    </>
  )
}
