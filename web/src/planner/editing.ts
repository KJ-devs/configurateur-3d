import { findFreePosition, footprintBounds, unionBounds, type Footprint } from './collision'
import { clampToBounds, computeWalls, footprintHalfExtents, polygonBounds, type Point } from './geometry'
import { snapMove, type Guide } from './snapping'

/** Minimal shape of a placed piece of furniture; the API instance type satisfies it. */
export type PlacedItem = { id: string; x: number; z: number; rotationY: number }

export type Size = { width: number; depth: number }

export type EditContext<T extends PlacedItem> = {
  sizeOf: (item: T) => Size | undefined
  polygon: Point[]
  wallThickness: number
  /** Grid step in mm, 0 disables it. */
  gridSize: number
}

const FULL_TURN = 360
const DUPLICATE_OFFSET = 200
const FREE_POSITION_STEP = 100

const normalizeRotation = (degrees: number): number => ((degrees % FULL_TURN) + FULL_TURN) % FULL_TURN

export const toFootprint = <T extends PlacedItem>(item: T, size: Size): Footprint => ({
  id: item.id,
  center: { x: item.x, z: item.z },
  width: size.width,
  depth: size.depth,
  rotation: item.rotationY,
})

export const toFootprints = <T extends PlacedItem>(items: T[], sizeOf: EditContext<T>['sizeOf']): Footprint[] =>
  items.flatMap((item) => {
    const size = sizeOf(item)
    return size ? [toFootprint(item, size)] : []
  })

const withPosition = <T extends PlacedItem>(item: T, position: Point, rotationY = item.rotationY): T => ({
  ...item,
  x: Math.round(position.x),
  z: Math.round(position.z),
  rotationY,
})

const clampItem = <T extends PlacedItem>(item: T, context: EditContext<T>): T => {
  const size = context.sizeOf(item)
  if (!size) return item

  const { halfX, halfZ } = footprintHalfExtents(size.width, size.depth, item.rotationY)
  return withPosition(item, clampToBounds({ x: item.x, z: item.z }, halfX, halfZ, polygonBounds(context.polygon)))
}

const dragSingle = <T extends PlacedItem>(
  snapshot: T[],
  lead: T,
  delta: Point,
  context: EditContext<T>,
  isSnapEnabled: boolean,
): { items: T[]; guides: Guide[] } => {
  const size = context.sizeOf(lead)
  if (!size) return { items: snapshot, guides: [] }

  const target = withPosition(lead, { x: lead.x + delta.x, z: lead.z + delta.z })
  if (!isSnapEnabled) {
    return { items: snapshot.map((item) => (item.id === lead.id ? clampItem(target, context) : item)), guides: [] }
  }

  const snapped = snapMove({
    moving: toFootprint(target, size),
    walls: computeWalls(context.polygon, context.wallThickness),
    others: toFootprints(snapshot.filter((item) => item.id !== lead.id), context.sizeOf),
    bounds: polygonBounds(context.polygon),
    gridSize: context.gridSize,
  })
  const moved = withPosition(lead, snapped.position, snapped.rotation)
  return { items: snapshot.map((item) => (item.id === lead.id ? moved : item)), guides: snapped.guides }
}

const dragGroup = <T extends PlacedItem>(snapshot: T[], ids: Set<string>, delta: Point, context: EditContext<T>): T[] => {
  const selected = snapshot.filter((item) => ids.has(item.id))
  const group = unionBounds(toFootprints(selected, context.sizeOf).map(footprintBounds))
  const room = polygonBounds(context.polygon)
  const clampedDelta = {
    x: Math.min(Math.max(delta.x, room.minX - group.minX), room.maxX - group.maxX),
    z: Math.min(Math.max(delta.z, room.minZ - group.minZ), room.maxZ - group.maxZ),
  }
  return snapshot.map((item) =>
    ids.has(item.id) ? withPosition(item, { x: item.x + clampedDelta.x, z: item.z + clampedDelta.z }) : item,
  )
}

/**
 * Moves the selection by `delta` from its position in `snapshot` (the state when the drag started).
 * A single item snaps to walls, furniture and the grid; a group moves rigidly inside the room.
 */
export const dragItems = <T extends PlacedItem>(
  snapshot: T[],
  selectedIds: string[],
  delta: Point,
  context: EditContext<T>,
  isSnapEnabled: boolean,
): { items: T[]; guides: Guide[] } => {
  const ids = new Set(selectedIds)
  const selected = snapshot.filter((item) => ids.has(item.id))
  if (selected.length === 0) return { items: snapshot, guides: [] }
  if (selected.length === 1) return dragSingle(snapshot, selected[0], delta, context, isSnapEnabled)
  return { items: dragGroup(snapshot, ids, delta, context), guides: [] }
}

export const rotateItems = <T extends PlacedItem>(items: T[], ids: string[], deltaDegrees: number, context: EditContext<T>): T[] =>
  items.map((item) =>
    ids.includes(item.id) ? clampItem({ ...item, rotationY: normalizeRotation(item.rotationY + deltaDegrees) }, context) : item,
  )

export const rotateItemTo = <T extends PlacedItem>(items: T[], id: string, degrees: number, context: EditContext<T>): T[] =>
  items.map((item) => (item.id === id ? clampItem({ ...item, rotationY: normalizeRotation(degrees) }, context) : item))

export const nudgeItems = <T extends PlacedItem>(items: T[], ids: string[], delta: Point, context: EditContext<T>): T[] =>
  dragGroup(items, new Set(ids), delta, context)

export const placeItem = <T extends PlacedItem>(items: T[], id: string, position: Point, context: EditContext<T>): T[] =>
  items.map((item) => (item.id === id ? clampItem(withPosition(item, position), context) : item))

/** Position near `wanted` where a new item does not overlap the existing ones. */
export const freePositionFor = <T extends PlacedItem>(item: T, items: T[], context: EditContext<T>): Point => {
  const size = context.sizeOf(item)
  if (!size) return { x: item.x, z: item.z }

  return findFreePosition(
    toFootprint(clampItem(item, context), size),
    toFootprints(items, context.sizeOf),
    polygonBounds(context.polygon),
    FREE_POSITION_STEP,
  )
}

export const duplicateItems = <T extends PlacedItem>(
  items: T[],
  ids: string[],
  context: EditContext<T>,
  createId: () => string,
): { items: T[]; newIds: string[] } => {
  const result = [...items]
  const newIds: string[] = []
  for (const source of items.filter((item) => ids.includes(item.id))) {
    const copy = { ...source, id: createId(), x: source.x + DUPLICATE_OFFSET, z: source.z + DUPLICATE_OFFSET }
    result.push(withPosition(copy, freePositionFor(copy, result, context)))
    newIds.push(copy.id)
  }
  return { items: result, newIds }
}
