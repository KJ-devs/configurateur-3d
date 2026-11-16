import type { ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { FurnitureInstanceDto } from '../../../api/generated/model'
import { usePlannerStore } from '../../../store/plannerStore'
import { rayToFloor } from './floorPlane'

const HANDLE_DISTANCE = 0.3
const HANDLE_RADIUS = 0.07
const HANDLE_COLOR = '#2f6f5e'
const STEM_WIDTH = 0.012
const ROTATION_STEP_DEG = 15
const RAD_TO_DEG = 180 / Math.PI
const ignoreRaycast = () => null

type Props = { instance: FurnitureInstanceDto; depth: number }

/** Grip in front of the selected furniture: dragging it rotates the furniture in 15° steps. */
export const RotationHandle = ({ instance, depth }: Props) => {
  const isRotating = useRef(false)
  const handleZ = depth / 2 + HANDLE_DISTANCE

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    isRotating.current = true
    ;(event.target as Element).setPointerCapture(event.pointerId)
    usePlannerStore.getState().beginDrag('Tourner')
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const floor = rayToFloor(event.ray)
    if (!isRotating.current || !floor) return
    event.stopPropagation()

    const degrees = Math.atan2(floor.x - instance.x, floor.z - instance.z) * RAD_TO_DEG
    const snapped = Math.round(degrees / ROTATION_STEP_DEG) * ROTATION_STEP_DEG
    usePlannerStore.getState().dragRotationTo(instance.id, snapped)
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!isRotating.current) return
    isRotating.current = false
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    usePlannerStore.getState().endDrag()
  }

  return (
    <group>
      <mesh position={[0, HANDLE_RADIUS, depth / 2 + HANDLE_DISTANCE / 2]} raycast={ignoreRaycast}>
        <boxGeometry args={[STEM_WIDTH, STEM_WIDTH, HANDLE_DISTANCE]} />
        <meshBasicMaterial color={HANDLE_COLOR} />
      </mesh>
      <mesh
        position={[0, HANDLE_RADIUS, handleZ]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={() => (document.body.style.cursor = 'alias')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <sphereGeometry args={[HANDLE_RADIUS, 20, 12]} />
        <meshBasicMaterial color={HANDLE_COLOR} />
      </mesh>
    </group>
  )
}
