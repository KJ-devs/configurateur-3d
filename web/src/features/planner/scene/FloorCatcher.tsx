import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import type { RoomDto } from '../../../api/generated/model'
import { dimensionsOf } from '../../../engine/furniture'
import { mmToM } from '../../../lib/units'
import { footprintBounds } from '../../../planner/collision'
import { toFootprints } from '../../../planner/editing'
import type { Point } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'
import { rayToFloor } from './floorPlane'

const CATCHER_SIZE = 400
const MARQUEE_COLOR = '#2f6f5e'
const MARQUEE_MIN_SIZE = 50
const CLICK_MAX_DISTANCE_PX = 4
const LEFT_BUTTON = 0
const ignoreRaycast = () => null

type Marquee = { start: Point; end: Point }
type Props = { room: RoomDto }

/**
 * Invisible plane under the scene catching what no furniture caught:
 * a click clears the selection, and in 2D a drag draws a selection rectangle.
 */
export const FloorCatcher = ({ room }: Props) => {
  const viewMode = usePlannerStore((state) => state.viewMode)
  const [marquee, setMarquee] = useState<Marquee | null>(null)

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    const floor = rayToFloor(event.ray)
    if (viewMode !== '2d' || event.button !== LEFT_BUTTON || !floor) return
    ;(event.target as Element).setPointerCapture(event.pointerId)
    setMarquee({ start: floor, end: floor })
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const floor = rayToFloor(event.ray)
    if (marquee && floor) setMarquee({ ...marquee, end: floor })
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!marquee) return
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    setMarquee(null)

    const { models, selectedIds, setSelection } = usePlannerStore.getState()
    const minX = Math.min(marquee.start.x, marquee.end.x)
    const maxX = Math.max(marquee.start.x, marquee.end.x)
    const minZ = Math.min(marquee.start.z, marquee.end.z)
    const maxZ = Math.max(marquee.start.z, marquee.end.z)
    if (maxX - minX < MARQUEE_MIN_SIZE && maxZ - minZ < MARQUEE_MIN_SIZE) return

    const touchedIds = toFootprints(room.instances, (instance) => dimensionsOf(models[instance.furnitureModelId], instance))
      .filter((footprint) => {
        const bounds = footprintBounds(footprint)
        return bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxZ >= minZ && bounds.minZ <= maxZ
      })
      .map((footprint) => footprint.id)
    setSelection(event.shiftKey ? [...new Set([...selectedIds, ...touchedIds])] : touchedIds)
  }

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta <= CLICK_MAX_DISTANCE_PX && !event.shiftKey) usePlannerStore.getState().clearSelection()
  }

  return (
    <>
      <mesh
        position-y={-0.02}
        rotation-x={-Math.PI / 2}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        <planeGeometry args={[CATCHER_SIZE, CATCHER_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {marquee && (
        <mesh
          position={[mmToM((marquee.start.x + marquee.end.x) / 2), 0.03, mmToM((marquee.start.z + marquee.end.z) / 2)]}
          rotation-x={-Math.PI / 2}
          raycast={ignoreRaycast}
        >
          <planeGeometry args={[mmToM(Math.abs(marquee.end.x - marquee.start.x)), mmToM(Math.abs(marquee.end.z - marquee.start.z))]} />
          <meshBasicMaterial color={MARQUEE_COLOR} transparent opacity={0.2} depthTest={false} />
        </mesh>
      )}
    </>
  )
}
