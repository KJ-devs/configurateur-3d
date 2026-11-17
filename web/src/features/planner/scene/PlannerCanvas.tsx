import { Grid } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import type { RoomDto } from '../../../api/generated/model'
import { dimensionsOf } from '../../../engine/furniture'
import { findCollisions, footprintsOverlap } from '../../../planner/collision'
import { toFootprints } from '../../../planner/editing'
import { computeWalls, rectanglePolygon, type Point } from '../../../planner/geometry'
import { planExtent } from '../../../planner/plan'
import { openingClearance } from '../../../planner/openings'
import { usePlannerStore } from '../../../store/plannerStore'
import { CameraRig } from './CameraRig'
import { CatalogDropHandler } from './CatalogDropHandler'
import { DimensionLines } from './DimensionLines'
import { DrawingLayer } from './DrawingLayer'
import { FloorCatcher } from './FloorCatcher'
import { FurnitureItem } from './FurnitureItem'
import { GhostFurniture } from './GhostFurniture'
import { GhostOpening } from './GhostOpening'
import { OpeningItem } from './OpeningItem'
import { OverviewScene, PlacedRoomView } from './OverviewScene'
import { RoomMesh } from './RoomMesh'
import { SelectionToolbar } from './SelectionToolbar'
import { SnapGuides } from './SnapGuides'
import { WallControls } from './WallControls'

const BACKGROUND_COLOR = '#f1efea'
const DRAWING_AREA = rectanglePolygon(8000, 6000)

/** Furniture overlapping other furniture, the swing of a door or the front of a window. */
const useCollidingIds = (room: RoomDto): Set<string> => {
  const models = usePlannerStore((state) => state.models)

  return useMemo(() => {
    const footprints = toFootprints(room.instances, (instance) => dimensionsOf(models[instance.furnitureModelId], instance))
    const colliding = findCollisions(footprints)
    const walls = computeWalls(room.floorPolygon, room.wallThickness)

    for (const opening of room.openings) {
      const clearance = openingClearance(opening, walls[opening.wallIndex])
      for (const footprint of footprints) {
        const instance = room.instances.find((candidate) => candidate.id === footprint.id)
        const height = instance ? (dimensionsOf(models[instance.furnitureModelId], instance)?.height ?? 0) : 0
        const isConcerned = opening.kind === 'Door' || height > opening.sillHeight
        if (isConcerned && footprintsOverlap(clearance, footprint)) colliding.add(footprint.id)
      }
    }
    return colliding
  }, [room.instances, room.openings, room.floorPolygon, room.wallThickness, models])
}

/**
 * The other visible rooms of the same group, at their place around the open room (which is drawn at the origin).
 * They give context and open with a click; only the open room is edited.
 */
const NeighbourRooms = ({ room }: { room: RoomDto }) => {
  const rooms = usePlannerStore((state) => state.rooms)
  const neighbours = rooms.filter(
    (other) => other.id !== room.id && !other.isHidden && (other.groupName ?? null) === (room.groupName ?? null),
  )
  return neighbours.map((other) => (
    <PlacedRoomView
      key={other.id}
      room={other}
      origin={{ x: other.positionX - room.positionX, z: other.positionZ - room.positionZ }}
      isMovable={false}
    />
  ))
}

/** Area to frame for the open room: the room and the visible rooms of its group, in the open room's coordinates. */
const useGroupOutline = (room: RoomDto): Point[] => {
  const rooms = usePlannerStore((state) => state.rooms)
  return useMemo(() => {
    const group = rooms.filter(
      (other) => other.id === room.id || (!other.isHidden && (other.groupName ?? null) === (room.groupName ?? null)),
    )
    const extent = planExtent(group.map((other) => ({ ...other, positionX: other.positionX - room.positionX, positionZ: other.positionZ - room.positionZ })))
    if (!extent) return room.floorPolygon
    return [
      { x: extent.minX, z: extent.minZ },
      { x: extent.maxX, z: extent.minZ },
      { x: extent.maxX, z: extent.maxZ },
      { x: extent.minX, z: extent.maxZ },
    ]
  }, [rooms, room])
}

const RoomScene = ({ room }: { room: RoomDto }) => {
  const selectedIds = usePlannerStore((state) => state.selectedIds)
  const collidingIds = useCollidingIds(room)
  const walls = useMemo(() => computeWalls(room.floorPolygon, room.wallThickness), [room.floorPolygon, room.wallThickness])
  const singleSelection = selectedIds.length === 1 ? room.instances.find((instance) => instance.id === selectedIds[0]) : undefined
  const groupOutline = useGroupOutline(room)

  return (
    <>
      <CameraRig frameKey={room.id} outline={groupOutline} ceilingHeight={room.ceilingHeight} />
      <FloorCatcher room={room} />
      <RoomMesh room={room} />
      <NeighbourRooms room={room} />
      {room.openings.map((opening) => (
        <OpeningItem key={opening.id} opening={opening} wall={walls[opening.wallIndex]} room={room} />
      ))}
      {room.instances.map((instance) => (
        <FurnitureItem key={instance.id} instance={instance} room={room} isColliding={collidingIds.has(instance.id)} />
      ))}

      {singleSelection && <DimensionLines instance={singleSelection} room={room} />}
      <WallControls room={room} />
      <SnapGuides />
      <SelectionToolbar room={room} />
      <GhostFurniture />
      <GhostOpening room={room} />
      <CatalogDropHandler room={room} />
    </>
  )
}

type Props = { room: RoomDto | undefined }

export const PlannerCanvas = ({ room }: Props) => {
  const isDrawing = usePlannerStore((state) => state.drawing !== null)
  const isOverview = usePlannerStore((state) => state.scope === 'overview')

  return (
    <Canvas frameloop="demand" dpr={[1, 2]}>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[6, 12, 8]} intensity={1.3} />
      <Grid
        position-y={-0.005}
        infiniteGrid
        cellSize={0.5}
        sectionSize={1}
        cellColor="#d6d3d1"
        sectionColor="#c4c0bb"
        fadeDistance={60}
        fadeStrength={1.5}
      />

      {isDrawing ? (
        <>
          <CameraRig frameKey="drawing" outline={DRAWING_AREA} ceilingHeight={0} />
          <DrawingLayer />
        </>
      ) : isOverview ? (
        <OverviewScene />
      ) : (
        room && <RoomScene room={room} />
      )}
    </Canvas>
  )
}
