import { footprintBounds, type Footprint } from './collision'
import { clampToBounds, footprintHalfExtents, type Bounds, type Point, type Wall } from './geometry'

export type Axis = 'x' | 'z'

/** Alignment line shown while dragging: constant on `axis`, spanning `from`..`to` on the other axis. */
export type Guide = { axis: Axis; value: number; from: number; to: number }

export type SnapInput = {
  /** The dragged footprint; `center` is where the pointer wants it, before any snapping. */
  moving: Footprint
  walls: Wall[]
  others: Footprint[]
  bounds: Bounds
  /** Grid step in mm, 0 disables the grid. */
  gridSize: number
}

export type SnapResult = { position: Point; rotation: number; guides: Guide[] }

export const WALL_SNAP_DISTANCE = 150
export const ALIGN_SNAP_DISTANCE = 60

const RAD_TO_DEG = 180 / Math.PI
const AXIS_ALIGNED_EPSILON = 1e-6
const AXES: Axis[] = ['x', 'z']

type WallSnap = { position: Point; rotation: number; freeAxes: Axis[] }

const normalizeDegrees = (degrees: number): number => ((Math.round(degrees) % 360) + 360) % 360

/** Puts the back of the furniture flush against the nearest wall within reach, front facing the room. */
const snapToWall = (moving: Footprint, walls: Wall[]): WallSnap | null => {
  let best: { wall: Wall; inwardDistance: number; along: number } | null = null

  for (const wall of walls) {
    const direction = { x: (wall.end.x - wall.start.x) / wall.length, z: (wall.end.z - wall.start.z) / wall.length }
    const offset = { x: moving.center.x - wall.start.x, z: moving.center.z - wall.start.z }
    const inwardDistance = -(offset.x * wall.normal.x + offset.z * wall.normal.z)
    const along = offset.x * direction.x + offset.z * direction.z
    const isWithinReach = inwardDistance - moving.depth / 2 < WALL_SNAP_DISTANCE && inwardDistance > -moving.depth
    const isAlongWall = along >= 0 && along <= wall.length

    if (isWithinReach && isAlongWall && (!best || inwardDistance < best.inwardDistance)) {
      best = { wall, inwardDistance, along }
    }
  }
  if (!best) return null

  const { wall } = best
  const direction = { x: (wall.end.x - wall.start.x) / wall.length, z: (wall.end.z - wall.start.z) / wall.length }
  const halfWidth = Math.min(moving.width, wall.length) / 2
  const along = Math.min(Math.max(best.along, halfWidth), wall.length - halfWidth)
  const freeAxes: Axis[] =
    Math.abs(wall.normal.x) < AXIS_ALIGNED_EPSILON ? ['x'] : Math.abs(wall.normal.z) < AXIS_ALIGNED_EPSILON ? ['z'] : []

  return {
    position: {
      x: wall.start.x + direction.x * along - (wall.normal.x * moving.depth) / 2,
      z: wall.start.z + direction.z * along - (wall.normal.z * moving.depth) / 2,
    },
    rotation: normalizeDegrees(Math.atan2(-wall.normal.x, -wall.normal.z) * RAD_TO_DEG),
    freeAxes,
  }
}

const edgesOnAxis = (bounds: Bounds, axis: Axis): number[] => {
  const [min, max] = axis === 'x' ? [bounds.minX, bounds.maxX] : [bounds.minZ, bounds.maxZ]
  return [min, (min + max) / 2, max]
}

type Alignment = { shift: number; guide: Guide }

/** Aligns an edge or the centre of the moving box with an edge or the centre of another one. */
const alignOnAxis = (moving: Bounds, others: Bounds[], axis: Axis): Alignment | null => {
  let best: { shift: number; value: number; other: Bounds } | null = null

  for (const other of others) {
    for (const target of edgesOnAxis(other, axis)) {
      for (const edge of edgesOnAxis(moving, axis)) {
        const shift = target - edge
        if (Math.abs(shift) < ALIGN_SNAP_DISTANCE && (!best || Math.abs(shift) < Math.abs(best.shift))) {
          best = { shift, value: target, other }
        }
      }
    }
  }
  if (!best) return null

  const span = axis === 'x' ? [moving.minZ, moving.maxZ, best.other.minZ, best.other.maxZ] : [moving.minX, moving.maxX, best.other.minX, best.other.maxX]
  return { shift: best.shift, guide: { axis, value: best.value, from: Math.min(...span), to: Math.max(...span) } }
}

/** Rounds the lower edge of the box to the grid, so edges land on round distances from the room origin. */
const snapToGrid = (center: number, half: number, gridSize: number): number =>
  Math.round((center - half) / gridSize) * gridSize + half

export const snapMove = ({ moving, walls, others, bounds, gridSize }: SnapInput): SnapResult => {
  const wallSnap = snapToWall(moving, walls)
  const rotation = wallSnap?.rotation ?? moving.rotation
  const freeAxes = wallSnap?.freeAxes ?? AXES
  const position = { ...(wallSnap?.position ?? moving.center) }
  const guides: Guide[] = []
  const otherBounds = others.map(footprintBounds)
  const { halfX, halfZ } = footprintHalfExtents(moving.width, moving.depth, rotation)

  for (const axis of freeAxes) {
    const movingBounds = footprintBounds({ ...moving, center: position, rotation })
    const alignment = alignOnAxis(movingBounds, otherBounds, axis)
    if (alignment) {
      position[axis] += alignment.shift
      guides.push(alignment.guide)
    } else if (gridSize > 0) {
      position[axis] = snapToGrid(position[axis], axis === 'x' ? halfX : halfZ, gridSize)
    }
  }

  return { position: clampToBounds(position, halfX, halfZ, bounds), rotation, guides }
}
