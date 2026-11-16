import type { Footprint } from './collision'
import type { Point, Wall } from './geometry'

/** Doors and windows clipped into walls. Pure TS, millimetres. */

export type OpeningKind = 'Door' | 'Window'

export type WallOpening = {
  id: string
  kind: OpeningKind
  wallIndex: number
  /** Distance from the wall start to the near edge of the opening. */
  offset: number
  width: number
  height: number
  sillHeight: number
}

export type OpeningPlacement = { wallIndex: number; offset: number }

/** Part of a wall left solid around its openings, in wall-local coordinates (x along, y up). */
export type WallSegment = { x0: number; x1: number; y0: number; y1: number }

export const OPENING_EDGE_MARGIN = 50
const OPENING_GAP = 50
const WINDOW_CLEARANCE_DEPTH = 100
const RAD_TO_DEG = 180 / Math.PI

const wallDirection = (wall: Wall): Point => ({
  x: (wall.end.x - wall.start.x) / wall.length,
  z: (wall.end.z - wall.start.z) / wall.length,
})

/** Wall closest to a point, with the position of the point's projection along it. */
export const nearestWall = (point: Point, walls: Wall[]): { wall: Wall; along: number; distance: number } | null => {
  let best: { wall: Wall; along: number; distance: number } | null = null
  for (const wall of walls) {
    const direction = wallDirection(wall)
    const offset = { x: point.x - wall.start.x, z: point.z - wall.start.z }
    const along = Math.min(Math.max(offset.x * direction.x + offset.z * direction.z, 0), wall.length)
    const closest = { x: wall.start.x + direction.x * along, z: wall.start.z + direction.z * along }
    const distance = Math.hypot(point.x - closest.x, point.z - closest.z)
    if (!best || distance < best.distance) best = { wall, along, distance }
  }
  return best
}

const overlapsOnWall = (offset: number, width: number, other: WallOpening): boolean =>
  offset < other.offset + other.width + OPENING_GAP && other.offset < offset + width + OPENING_GAP

/**
 * Clips an opening of the given width into the wall nearest to the point, centred on the point.
 * Returns null when the wall is too short or the spot is taken by another opening.
 */
export const placeOpening = (
  point: Point,
  width: number,
  walls: Wall[],
  others: WallOpening[],
  maxDistance = Infinity,
): OpeningPlacement | null => {
  const nearest = nearestWall(point, walls)
  if (!nearest || nearest.distance > maxDistance) return null

  const { wall, along } = nearest
  const maxOffset = wall.length - width - OPENING_EDGE_MARGIN
  if (maxOffset < OPENING_EDGE_MARGIN) return null

  const offset = Math.round(Math.min(Math.max(along - width / 2, OPENING_EDGE_MARGIN), maxOffset))
  const isTaken = others.some((other) => other.wallIndex === wall.index && overlapsOnWall(offset, width, other))
  return isTaken ? null : { wallIndex: wall.index, offset }
}

/** First free spot for a new opening, trying the longest walls first. */
export const findOpeningSpot = (width: number, walls: Wall[], others: WallOpening[]): OpeningPlacement | null => {
  const byLength = [...walls].sort((a, b) => b.length - a.length)
  for (const wall of byLength) {
    const direction = wallDirection(wall)
    for (let along = wall.length / 2; along < wall.length; along += width / 2) {
      const point = { x: wall.start.x + direction.x * along, z: wall.start.z + direction.z * along }
      const placement = placeOpening(point, width, [wall], others)
      if (placement) return placement
    }
  }
  return null
}

/** Centre of the opening on the inner face of its wall. */
export const openingCenter = (opening: WallOpening, wall: Wall): Point => {
  const direction = wallDirection(wall)
  const along = opening.offset + opening.width / 2
  return { x: wall.start.x + direction.x * along, z: wall.start.z + direction.z * along }
}

/** Solid boxes of a wall once its openings are cut out. `bodyLength` includes the corner fill. */
export const wallSegments = (bodyLength: number, height: number, openings: WallOpening[]): WallSegment[] => {
  const sorted = [...openings].sort((a, b) => a.offset - b.offset)
  const segments: WallSegment[] = []
  let cursor = 0

  for (const opening of sorted) {
    const top = Math.min(opening.sillHeight + opening.height, height)
    if (opening.offset > cursor) segments.push({ x0: cursor, x1: opening.offset, y0: 0, y1: height })
    if (opening.sillHeight > 0) segments.push({ x0: opening.offset, x1: opening.offset + opening.width, y0: 0, y1: opening.sillHeight })
    if (top < height) segments.push({ x0: opening.offset, x1: opening.offset + opening.width, y0: top, y1: height })
    cursor = opening.offset + opening.width
  }
  if (cursor < bodyLength) segments.push({ x0: cursor, x1: bodyLength, y0: 0, y1: height })
  return segments
}

/**
 * Floor area an opening needs free: the swing of a door, a thin strip under a window.
 * A window only blocks furniture taller than its sill, which the caller checks.
 */
export const openingClearance = (opening: WallOpening, wall: Wall): Footprint => {
  const depth = opening.kind === 'Door' ? opening.width : WINDOW_CLEARANCE_DEPTH
  const center = openingCenter(opening, wall)
  return {
    id: `opening:${opening.id}`,
    center: { x: center.x - (wall.normal.x * depth) / 2, z: center.z - (wall.normal.z * depth) / 2 },
    width: opening.width,
    depth,
    rotation: Math.atan2(-wall.normal.x, -wall.normal.z) * RAD_TO_DEG,
  }
}
