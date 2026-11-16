import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, Shape, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import type { RoomDto } from '../../../api/generated/model'
import { mmToM } from '../../../lib/units'
import { computeWalls } from '../../../planner/geometry'
import { wallSegments } from '../../../planner/openings'
import { usePlannerStore } from '../../../store/plannerStore'

const FLOOR_COLOR = '#e9dfcd'
const WALL_COLOR_3D = '#f7f5f0'
const WALL_COLOR_2D = '#44403c'
const HIDDEN_WALL_OPACITY = 0.08
const ignoreRaycast = () => null

type Props = { room: RoomDto }

export const RoomMesh = ({ room }: Props) => {
  const viewMode = usePlannerStore((state) => state.viewMode)
  const wallRefs = useRef<(Group | null)[]>([])

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
  const thickness = mmToM(room.wallThickness)

  // Walls standing between the camera and the room fade out so the inside stays visible.
  useFrame(({ camera }) => {
    walls.forEach((wall, index) => {
      const towardsCamera =
        wall.normal.x * (camera.position.x - mmToM(wall.center.x)) + wall.normal.z * (camera.position.z - mmToM(wall.center.z))
      const isHidden = viewMode === '3d' && towardsCamera > 0
      wallRefs.current[index]?.children.forEach((child) => {
        const material = (child as Mesh).material as MeshStandardMaterial
        material.opacity = isHidden ? HIDDEN_WALL_OPACITY : 1
        material.depthWrite = !isHidden
      })
    })
  })

  return (
    <group>
      <mesh rotation-x={Math.PI / 2} raycast={ignoreRaycast}>
        <shapeGeometry args={[floorShape]} />
        <meshStandardMaterial color={FLOOR_COLOR} side={DoubleSide} />
      </mesh>

      {walls.map((wall, index) => (
        <group
          key={wall.index}
          ref={(group) => {
            wallRefs.current[index] = group
          }}
          position={[mmToM(wall.start.x), 0, mmToM(wall.start.z)]}
          rotation-y={wall.rotationY}
        >
          {wallSegments(wall.bodyLength, room.ceilingHeight, room.openings.filter((opening) => opening.wallIndex === wall.index)).map(
            (segment) => (
              <mesh
                key={`${segment.x0}-${segment.y0}`}
                position={[mmToM((segment.x0 + segment.x1) / 2), mmToM((segment.y0 + segment.y1) / 2), (-wall.inwardZ * thickness) / 2]}
                raycast={ignoreRaycast}
              >
                <boxGeometry args={[mmToM(segment.x1 - segment.x0), mmToM(segment.y1 - segment.y0), thickness]} />
                <meshStandardMaterial color={viewMode === '2d' ? WALL_COLOR_2D : WALL_COLOR_3D} transparent />
              </mesh>
            ),
          )}
        </group>
      ))}
    </group>
  )
}
