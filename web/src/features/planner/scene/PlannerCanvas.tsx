import { Grid } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import type { RoomDto } from '../../../api/generated/model'
import { usePlannerStore } from '../../../store/plannerStore'
import { CameraRig } from './CameraRig'
import { CatalogDropHandler } from './CatalogDropHandler'
import { FurnitureItem } from './FurnitureItem'
import { GhostFurniture } from './GhostFurniture'
import { RoomMesh } from './RoomMesh'

const BACKGROUND_COLOR = '#f1efea'
type Props = { room: RoomDto }

export const PlannerCanvas = ({ room }: Props) => {
  const clearSelection = usePlannerStore((state) => state.clearSelection)

  return (
    <Canvas frameloop="demand" dpr={[1, 2]} onPointerMissed={clearSelection}>
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
      <RoomMesh room={room} />

      {room.instances.map((instance) => (
        <FurnitureItem key={instance.id} instance={instance} room={room} />
      ))}

      <GhostFurniture />
      <CatalogDropHandler room={room} />
    </Canvas>
  )
}
