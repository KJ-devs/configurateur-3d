import { footprintCorners, footprintHalfExtents, isInsidePolygon, type Bounds, type Point } from './geometry'

/** Oriented rectangle occupied by a piece of furniture on the floor (mm, degrees). */
export type Footprint = { id: string; center: Point; width: number; depth: number; rotation: number }

/** Furniture pushed flush against each other touches without overlapping. */
const TOUCH_TOLERANCE = 1

const DEG_TO_RAD = Math.PI / 180

const projectOnAxis = (corners: Point[], axis: Point): { min: number; max: number } => {
  const values = corners.map((corner) => corner.x * axis.x + corner.z * axis.z)
  return { min: Math.min(...values), max: Math.max(...values) }
}

const footprintAxes = (rotation: number): Point[] => {
  const cos = Math.cos(rotation * DEG_TO_RAD)
  const sin = Math.sin(rotation * DEG_TO_RAD)
  return [
    { x: cos, z: -sin },
    { x: sin, z: cos },
  ]
}

/** Separating axis test between two oriented rectangles. */
export const footprintsOverlap = (a: Footprint, b: Footprint): boolean => {
  const cornersA = footprintCorners(a.center, a.width, a.depth, a.rotation)
  const cornersB = footprintCorners(b.center, b.width, b.depth, b.rotation)

  return [...footprintAxes(a.rotation), ...footprintAxes(b.rotation)].every((axis) => {
    const rangeA = projectOnAxis(cornersA, axis)
    const rangeB = projectOnAxis(cornersB, axis)
    return rangeA.max - rangeB.min > TOUCH_TOLERANCE && rangeB.max - rangeA.min > TOUCH_TOLERANCE
  })
}

/** Ids of every footprint overlapping at least one other. */
export const findCollisions = (footprints: Footprint[]): Set<string> => {
  const colliding = new Set<string>()
  footprints.forEach((a, index) => {
    footprints.slice(index + 1).forEach((b) => {
      if (!footprintsOverlap(a, b)) return
      colliding.add(a.id)
      colliding.add(b.id)
    })
  })
  return colliding
}

export const footprintBounds = (footprint: Footprint): Bounds => {
  const { halfX, halfZ } = footprintHalfExtents(footprint.width, footprint.depth, footprint.rotation)
  return {
    minX: footprint.center.x - halfX,
    maxX: footprint.center.x + halfX,
    minZ: footprint.center.z - halfZ,
    maxZ: footprint.center.z + halfZ,
  }
}

export const unionBounds = (boundsList: Bounds[]): Bounds => ({
  minX: Math.min(...boundsList.map((bounds) => bounds.minX)),
  maxX: Math.max(...boundsList.map((bounds) => bounds.maxX)),
  minZ: Math.min(...boundsList.map((bounds) => bounds.minZ)),
  maxZ: Math.max(...boundsList.map((bounds) => bounds.maxZ)),
})

export const isFootprintInside = (footprint: Footprint, polygon: Point[]): boolean =>
  isInsidePolygon(footprintCorners(footprint.center, footprint.width, footprint.depth, footprint.rotation), polygon)

const SEARCH_RINGS = 30

/**
 * Nearest position around the wanted one where the footprint fits in the bounds without overlapping
 * anything. Falls back to the wanted position when the surroundings are full.
 * Pass the room polygon for rooms that are not rectangular.
 */
export const findFreePosition = (
  footprint: Footprint,
  others: Footprint[],
  bounds: Bounds,
  step: number,
  polygon?: Point[],
): Point => {
  const { halfX, halfZ } = footprintHalfExtents(footprint.width, footprint.depth, footprint.rotation)
  const candidates: Point[] = []
  for (let ring = 0; ring <= SEARCH_RINGS; ring++) {
    for (let offsetX = -ring; offsetX <= ring; offsetX++) {
      for (let offsetZ = -ring; offsetZ <= ring; offsetZ++) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) !== ring) continue
        candidates.push({ x: footprint.center.x + offsetX * step, z: footprint.center.z + offsetZ * step })
      }
    }
  }

  const isFree = (center: Point): boolean =>
    center.x - halfX >= bounds.minX &&
    center.x + halfX <= bounds.maxX &&
    center.z - halfZ >= bounds.minZ &&
    center.z + halfZ <= bounds.maxZ &&
    (!polygon || isFootprintInside({ ...footprint, center }, polygon)) &&
    others.every((other) => !footprintsOverlap({ ...footprint, center }, other))

  return candidates.find(isFree) ?? footprint.center
}
