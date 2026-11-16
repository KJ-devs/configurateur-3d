import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, Shape, type Mesh, type MeshStandardMaterial } from 'three'
import type { RoomDto } from '../../../api/generated/model'
import { mmToM } from '../../../lib/units'
import { computeWalls } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'

const FLOOR_COLOR = '#e9dfcd'
const WALL_COLOR_3D = '#f7f5f0'
const WALL_COLOR_2D = '#44403c'
const HIDDEN_WALL_OPACITY = 0.08
const ignoreRaycast = () => null

type Props = { room: RoomDto }

export const RoomMesh = ({ room }: Props) => {
  const viewMode = usePlannerStore((state) => state.viewMode)
  const wallRefs = useRef<(Mesh | null)[]>([])

  const floorShape = useMemo(() => {
    const shape = new Shape()
    room.floorPolygon.forEach((point, index) => {
      if (index === 0) shape.moveTo(mmToM(point.x), mmToM(point.z))
      else shape.lineTo(mmToM(point.x), mmToM(point.z))
    })
    shape.closePath()
    return shape
  }, [room.floorPolygon])

  const walls = useMemo(() => computeWalls(room.floorPolygon, room.wallThickness), [room.floorPolygon, room.wallThickness])
  const wallHeight = mmToM(room.ceilingHeight)
  const wallThickness = mmToM(room.wallThickness)

  // Walls standing between the camera and the room fade out so the inside stays visible.
  useFrame(({ camera }) => {
    walls.forEach((wall, index) => {
      const mesh = wallRefs.current[index]
      if (!mesh) return

      const towardsCamera =
        wall.normal.x * (camera.position.x - mmToM(wall.center.x)) + wall.normal.z * (camera.position.z - mmToM(wall.center.z))
      const isHidden = viewMode === '3d' && towardsCamera > 0
      const material = mesh.material as MeshStandardMaterial
      material.opacity = isHidden ? HIDDEN_WALL_OPACITY : 1
      material.depthWrite = !isHidden
    })
  })

  return (
    <group>
      <mesh rotation-x={Math.PI / 2} raycast={ignoreRaycast}>
        <shapeGeometry args={[floorShape]} />
        <meshStandardMaterial color={FLOOR_COLOR} side={DoubleSide} />
      </mesh>

      {walls.map((wall, index) => (
        <mesh
          key={wall.index}
          ref={(mesh) => {
            wallRefs.current[index] = mesh
          }}
          position={[mmToM(wall.center.x), wallHeight / 2, mmToM(wall.center.z)]}
          rotation-y={wall.rotationY}
          raycast={ignoreRaycast}
        >
          <boxGeometry args={[mmToM(wall.bodyLength), wallHeight, wallThickness]} />
          <meshStandardMaterial color={viewMode === '2d' ? WALL_COLOR_2D : WALL_COLOR_3D} transparent />
        </mesh>
      ))}
    </group>
  )
}
