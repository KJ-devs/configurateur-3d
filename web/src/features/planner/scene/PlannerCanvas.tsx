import { Grid } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import type { RoomDto } from '../../../api/generated/model'
import { findCollisions } from '../../../planner/collision'
import { toFootprints } from '../../../planner/editing'
import { usePlannerStore } from '../../../store/plannerStore'
import { CameraRig } from './CameraRig'
import { CatalogDropHandler } from './CatalogDropHandler'
import { DimensionLines } from './DimensionLines'
import { FloorCatcher } from './FloorCatcher'
import { FurnitureItem } from './FurnitureItem'
import { GhostFurniture } from './GhostFurniture'
import { RoomMesh } from './RoomMesh'
import { SelectionToolbar } from './SelectionToolbar'
import { SnapGuides } from './SnapGuides'

const BACKGROUND_COLOR = '#f1efea'

type Props = { room: RoomDto }

export const PlannerCanvas = ({ room }: Props) => {
  const models = usePlannerStore((state) => state.models)
  const selectedIds = usePlannerStore((state) => state.selectedIds)

  const collidingIds = useMemo(
    () => findCollisions(toFootprints(room.instances, (instance) => models[instance.furnitureModelId])),
    [room.instances, models],
  )
  const singleSelection = selectedIds.length === 1 ? room.instances.find((instance) => instance.id === selectedIds[0]) : undefined

  return (
    <Canvas frameloop="demand" dpr={[1, 2]}>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[6, 12, 8]} intensity={1.3} />

      <CameraRig room={room} />
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
      <FloorCatcher room={room} />
      <RoomMesh room={room} />

      {room.instances.map((instance) => (
        <FurnitureItem key={instance.id} instance={instance} room={room} isColliding={collidingIds.has(instance.id)} />
      ))}

      {singleSelection && <DimensionLines instance={singleSelection} room={room} />}
      <SnapGuides />
      <SelectionToolbar room={room} />
      <GhostFurniture />
      <CatalogDropHandler room={room} />
    </Canvas>
  )
}
