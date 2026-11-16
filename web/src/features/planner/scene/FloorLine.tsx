import { mmToM } from '../../../lib/units'
import type { Point } from '../../../planner/geometry'

const LINE_THICKNESS = 0.002
const ignoreRaycast = () => null

type Props = {
  from: Point
  to: Point
  color: string
  /** Width of the line in metres. */
  width?: number
  /** Height above the floor in metres. */
  elevation?: number
}

/** Flat line drawn on the floor between two points given in millimetres. */
export const FloorLine = ({ from, to, color, width = 0.012, elevation = 0.012 }: Props) => {
  const deltaX = mmToM(to.x - from.x)
  const deltaZ = mmToM(to.z - from.z)
  const length = Math.hypot(deltaX, deltaZ)
  if (length === 0) return null

  return (
    <mesh
      position={[mmToM(from.x) + deltaX / 2, elevation, mmToM(from.z) + deltaZ / 2]}
      rotation-y={-Math.atan2(deltaZ, deltaX)}
      raycast={ignoreRaycast}
      renderOrder={2}
    >
      <boxGeometry args={[length, LINE_THICKNESS, width]} />
      <meshBasicMaterial color={color} depthTest={false} transparent />
    </mesh>
  )
}
