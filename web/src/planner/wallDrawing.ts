import { polygonBounds, type Point } from './geometry'

/** Free-hand room drawing: angle and length snapping, closing and validation. Pure TS. */

export const ANGLE_STEP_DEG = 45
export const MIN_SEGMENT_LENGTH = 100

const DEG_TO_RAD = Math.PI / 180
const INTERSECTION_EPSILON = 1e-9

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.z - a.z)

/** Direction from `last` to `cursor`, snapped to the nearest multiple of 45°. */
export const snappedDirection = (last: Point, cursor: Point): Point => {
  const angle = Math.atan2(cursor.z - last.z, cursor.x - last.x) / DEG_TO_RAD
  const snapped = Math.round(angle / ANGLE_STEP_DEG) * ANGLE_STEP_DEG * DEG_TO_RAD
  return { x: Math.cos(snapped), z: Math.sin(snapped) }
}

export const pointAtLength = (last: Point, direction: Point, length: number): Point => ({
  x: Math.round(last.x + direction.x * length),
  z: Math.round(last.z + direction.z * length),
})

/** Next wall end: direction snapped to 0/45/90°, length rounded to the grid. */
export const snapDrawPoint = (last: Point, cursor: Point, gridSize: number): Point => {
  const direction = snappedDirection(last, cursor)
  const projected = (cursor.x - last.x) * direction.x + (cursor.z - last.z) * direction.z
  const length = gridSize > 0 ? Math.round(projected / gridSize) * gridSize : projected
  return pointAtLength(last, direction, Math.max(length, 0))
}

/** First point of a drawing, simply rounded to the grid. */
export const snapFirstPoint = (cursor: Point, gridSize: number): Point =>
  gridSize > 0
    ? { x: Math.round(cursor.x / gridSize) * gridSize, z: Math.round(cursor.z / gridSize) * gridSize }
    : { x: Math.round(cursor.x), z: Math.round(cursor.z) }

/** True when the cursor is close enough to the first point to close the outline. */
export const isClosingPoint = (points: Point[], cursor: Point, tolerance: number): boolean =>
  points.length >= 3 && distance(points[0], cursor) <= tolerance

const orientation = (a: Point, b: Point, c: Point): number => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)

const segmentsCross = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const d1 = orientation(c, d, a)
  const d2 = orientation(c, d, b)
  const d3 = orientation(a, b, c)
  const d4 = orientation(a, b, d)
  return d1 * d2 < -INTERSECTION_EPSILON && d3 * d4 < -INTERSECTION_EPSILON
}

/** A room outline is valid when it has 3+ corners, no tiny wall and no crossing walls. */
export const isValidOutline = (points: Point[]): boolean => {
  if (points.length < 3) return false

  const edges = points.map((start, index) => ({ start, end: points[(index + 1) % points.length] }))
  if (edges.some((edge) => distance(edge.start, edge.end) < MIN_SEGMENT_LENGTH)) return false

  return edges.every((first, i) =>
    edges.every((second, j) => {
      const areNeighbours = Math.abs(i - j) <= 1 || Math.abs(i - j) === edges.length - 1
      return areNeighbours || !segmentsCross(first.start, first.end, second.start, second.end)
    }),
  )
}

/** True when adding `next` after the drawn points would cross an existing wall. */
export const wouldCross = (points: Point[], next: Point): boolean => {
  const last = points.at(-1)
  if (!last) return false
  return points.slice(0, -2).some((start, index) => segmentsCross(start, points[index + 1], last, next))
}

/** Moves the outline so its bounding box starts at the origin. */
export const normalizeOutline = (points: Point[]): Point[] => {
  const bounds = polygonBounds(points)
  return points.map((point) => ({ x: point.x - bounds.minX, z: point.z - bounds.minZ }))
}
