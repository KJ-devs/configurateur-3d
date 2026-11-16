import type { RoomDto } from '../../../api/generated/model'
import { mmToM } from '../../../lib/units'
import { computeWalls } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'

const GHOST_COLOR = '#2f6f5e'
const GHOST_SIZES = { Door: { width: 830, height: 2040, sillHeight: 0 }, Window: { width: 1200, height: 1250, sillHeight: 900 } }
const ignoreRaycast = () => null

type Props = { room: RoomDto }

/** Preview of a door or window clipped into the wall under the cursor while it is dragged from the palette. */
export const GhostOpening = ({ room }: Props) => {
  const ghost = usePlannerStore((state) => state.ghost)
  if (ghost?.kind !== 'opening' || !ghost.placement) return null

  const wall = computeWalls(room.floorPolygon, room.wallThickness)[ghost.placement.wallIndex]
  const size = GHOST_SIZES[ghost.openingKind]
  const thickness = mmToM(room.wallThickness)

  return (
    <group position={[mmToM(wall.start.x), 0, mmToM(wall.start.z)]} rotation-y={wall.rotationY}>
      <mesh
        position={[
          mmToM(ghost.placement.offset + size.width / 2),
          mmToM(size.sillHeight + size.height / 2),
          (-wall.inwardZ * thickness) / 2,
        ]}
        raycast={ignoreRaycast}
        renderOrder={3}
      >
        <boxGeometry args={[mmToM(size.width), mmToM(size.height), thickness * 1.3]} />
        <meshBasicMaterial color={GHOST_COLOR} transparent opacity={0.6} depthTest={false} />
      </mesh>
    </group>
  )
}
