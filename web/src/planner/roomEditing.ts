import { toFootprint, placeItem, type EditContext, type PlacedItem } from './editing'
import { computeWalls, footprintCorners, polygonBounds, rectanglePolygon, type Point, type Wall } from './geometry'
import { OPENING_EDGE_MARGIN, type WallOpening } from './openings'
import { isValidOutline } from './wallDrawing'

/** Resizing a room after it was created: moving walls, typing lengths. Pure TS, millimetres. */

export const MIN_WALL_LENGTH = 500
const MIN_OPENING_WIDTH = 300
/** Furniture closer than this to a moving wall travels with it. */
const FOLLOW_TOLERANCE = 30
const SEARCH_STEPS = 14

const isValidRoom = (polygon: Point[]): boolean =>
  isValidOutline(polygon) && computeWalls(polygon, 0).every((wall) => wall.length >= MIN_WALL_LENGTH)

const translate = (polygon: Point[], indices: number[], delta: Point): Point[] =>
  polygon.map((point, index) =>
    indices.includes(index) ? { x: Math.round(point.x + delta.x), z: Math.round(point.z + delta.z) } : point,
  )

const direction = (wall: Wall): Point => ({ x: (wall.end.x - wall.start.x) / wall.length, z: (wall.end.z - wall.start.z) / wall.length })

export type WallMove = { polygon: Point[]; delta: Point; wallIndex: number }

/**
 * Pushes wall `wallIndex` outwards by `distance` mm (negative = inwards), both its corners moving together.
 * When the full move would break the room, goes as far as it can.
 */
export const moveWall = (polygon: Point[], wallIndex: number, distance: number): WallMove => {
  const wall = computeWalls(polygon, 0)[wallIndex]
  const corners = [wallIndex, (wallIndex + 1) % polygon.length]
  const deltaFor = (amount: number): Point => ({ x: wall.normal.x * amount, z: wall.normal.z * amount })
  const attempt = (amount: number) => translate(polygon, corners, deltaFor(amount))

  if (isValidRoom(attempt(distance))) return { polygon: attempt(distance), delta: deltaFor(distance), wallIndex }

  let valid = 0
  let invalid = distance
  for (let step = 0; step < SEARCH_STEPS; step++) {
    const middle = (valid + invalid) / 2
    if (isValidRoom(attempt(middle))) valid = middle
    else invalid = middle
  }
  const reachable = Math.trunc(valid)
  return { polygon: attempt(reachable), delta: deltaFor(reachable), wallIndex }
}

/**
 * Gives wall `wallIndex` a new length by sliding the next wall along it, the way a tape measure would.
 * Returns null when the room would not be valid any more.
 */
export const setWallLength = (polygon: Point[], wallIndex: number, length: number): WallMove | null => {
  const wall = computeWalls(polygon, 0)[wallIndex]
  const along = direction(wall)
  const change = length - wall.length
  const delta = { x: along.x * change, z: along.z * change }
  const next = (wallIndex + 1) % polygon.length
  const moved = translate(polygon, [next, (next + 1) % polygon.length], delta)
  return isValidRoom(moved) ? { polygon: moved, delta, wallIndex: next } : null
}

/** Width and depth of an axis-aligned rectangular room, or null for any other shape. */
export const rectangleSize = (polygon: Point[]): { width: number; depth: number } | null => {
  if (polygon.length !== 4) return null
  const bounds = polygonBounds(polygon)
  const isOnCorner = (point: Point) =>
    (point.x === bounds.minX || point.x === bounds.maxX) && (point.z === bounds.minZ || point.z === bounds.maxZ)
  if (!polygon.every(isOnCorner)) return null
  return { width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ }
}

/** Same rectangle with a new size, keeping its top-left corner and its point order. */
export const resizeRectangle = (polygon: Point[], width: number, depth: number): Point[] => {
  const bounds = polygonBounds(polygon)
  const target = rectanglePolygon(width, depth).map((point) => ({ x: point.x + bounds.minX, z: point.z + bounds.minZ }))
  return polygon.map((point) => ({
    x: point.x === bounds.minX ? target[0].x : target[1].x,
    z: point.z === bounds.minZ ? target[0].z : target[2].z,
  }))
}

/** Openings keep their wall: they slide and, if needed, narrow to stay inside it; those that cannot fit are dropped. */
export const fitOpenings = <T extends WallOpening>(openings: T[], polygon: Point[]): T[] => {
  const walls = computeWalls(polygon, 0)
  return openings.flatMap((opening) => {
    const wall = walls[opening.wallIndex]
    const maxWidth = wall ? wall.length - OPENING_EDGE_MARGIN * 2 : 0
    if (maxWidth < MIN_OPENING_WIDTH) return []
    const width = Math.min(opening.width, maxWidth)
    const offset = Math.min(Math.max(opening.offset, OPENING_EDGE_MARGIN), wall.length - width - OPENING_EDGE_MARGIN)
    return [{ ...opening, width, offset: Math.round(offset) }]
  })
}

/** True when the item stands against the wall (any corner within the tolerance of its line). */
const isAgainstWall = <T extends PlacedItem>(item: T, wall: Wall, context: EditContext<T>): boolean => {
  const size = context.sizeOf(item)
  if (!size) return false
  const footprint = toFootprint(item, size)
  return footprintCorners(footprint.center, footprint.width, footprint.depth, footprint.rotation).some(
    (corner) => (corner.x - wall.start.x) * wall.normal.x + (corner.z - wall.start.z) * wall.normal.z >= -FOLLOW_TOLERANCE,
  )
}

/**
 * Furniture after the room changed shape: items against the moved wall travel with it,
 * then everything is kept inside the new outline.
 */
export const fitItems = <T extends PlacedItem>(
  items: T[],
  before: Point[],
  move: WallMove | null,
  context: EditContext<T>,
): T[] => {
  const movedWall = move && computeWalls(before, 0)[move.wallIndex]
  const followed = items.map((item) =>
    movedWall && isAgainstWall(item, movedWall, { ...context, polygon: before })
      ? { ...item, x: Math.round(item.x + move.delta.x), z: Math.round(item.z + move.delta.z) }
      : item,
  )
  return followed.reduce((current, item) => placeItem(current, item.id, item, context), followed)
}
