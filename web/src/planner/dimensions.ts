import type { Point } from './geometry'

export type Direction = 'left' | 'right' | 'up' | 'down'

/** Clear distance between one side of a furniture bounding box and the wall facing it. */
export type WallDistance = { direction: Direction; from: Point; to: Point; distance: number }

const DIRECTION_VECTORS: Record<Direction, Point> = {
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 },
  up: { x: 0, z: -1 },
  down: { x: 0, z: 1 },
}

const PARALLEL_EPSILON = 1e-9

/** Distance along the ray to the segment, or null when they do not meet. */
const raySegmentDistance = (origin: Point, direction: Point, start: Point, end: Point): number | null => {
  const edge = { x: end.x - start.x, z: end.z - start.z }
  const denominator = direction.x * edge.z - direction.z * edge.x
  if (Math.abs(denominator) < PARALLEL_EPSILON) return null

  const toStart = { x: start.x - origin.x, z: start.z - origin.z }
  const rayDistance = (toStart.x * edge.z - toStart.z * edge.x) / denominator
  const edgePosition = (toStart.x * direction.z - toStart.z * direction.x) / denominator
  return rayDistance >= 0 && edgePosition >= 0 && edgePosition <= 1 ? rayDistance : null
}

/** Distances from the four sides of an axis-aligned box to the nearest walls of the room. */
export const wallDistances = (center: Point, halfX: number, halfZ: number, polygon: Point[]): WallDistance[] =>
  (Object.keys(DIRECTION_VECTORS) as Direction[]).flatMap((direction) => {
    const vector = DIRECTION_VECTORS[direction]
    const from = { x: center.x + vector.x * halfX, z: center.z + vector.z * halfZ }
    const hits = polygon
      .map((start, index) => raySegmentDistance(from, vector, start, polygon[(index + 1) % polygon.length]))
      .filter((hit): hit is number => hit !== null)
    if (hits.length === 0) return []

    const distance = Math.min(...hits)
    return [{ direction, from, to: { x: from.x + vector.x * distance, z: from.z + vector.z * distance }, distance }]
  })

/** Centre the furniture must take for the given side to sit at `distance` from its wall. */
export const centerForWallDistance = (center: Point, current: WallDistance, distance: number): Point => {
  const vector = DIRECTION_VECTORS[current.direction]
  const shift = current.distance - distance
  return { x: center.x + vector.x * shift, z: center.z + vector.z * shift }
}
