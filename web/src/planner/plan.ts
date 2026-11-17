import { polygonBounds, type Bounds, type Point } from './geometry'

/** The overall plan of a project: rooms placed next to each other. Pure TS, millimetres. */

export type PlacedRoom = { id: string; floorPolygon: Point[]; positionX: number; positionZ: number; wallThickness: number }

const SNAP_DISTANCE = 300

/** Bounds of the room's floor on the overall plan. */
export const planBounds = (room: PlacedRoom): Bounds => {
  const local = polygonBounds(room.floorPolygon)
  return {
    minX: local.minX + room.positionX,
    maxX: local.maxX + room.positionX,
    minZ: local.minZ + room.positionZ,
    maxZ: local.maxZ + room.positionZ,
  }
}

/** Bounds enclosing every room, walls included. */
export const planExtent = (rooms: PlacedRoom[]): Bounds | null => {
  if (rooms.length === 0) return null
  const all = rooms.map((room) => {
    const bounds = planBounds(room)
    const wall = room.wallThickness
    return { minX: bounds.minX - wall, maxX: bounds.maxX + wall, minZ: bounds.minZ - wall, maxZ: bounds.maxZ + wall }
  })
  return {
    minX: Math.min(...all.map((bounds) => bounds.minX)),
    maxX: Math.max(...all.map((bounds) => bounds.maxX)),
    minZ: Math.min(...all.map((bounds) => bounds.minZ)),
    maxZ: Math.max(...all.map((bounds) => bounds.maxZ)),
  }
}

/** Spot for a new room: against the right of the others, sharing their wall, aligned with the top of the plan. */
export const nextRoomPosition = (rooms: PlacedRoom[]): Point => {
  const extent = planExtent(rooms)
  return extent ? { x: Math.round(extent.maxX), z: Math.round(extent.minZ + rooms[0].wallThickness) } : { x: 0, z: 0 }
}

/**
 * Rooms made before they had a place on the plan all sit at the origin, on top of each other.
 * Keeps the first one there and lines the others up beside it; returns only the rooms that move.
 */
export const spreadStackedRooms = <T extends PlacedRoom>(rooms: T[]): T[] => {
  const atOrigin = rooms.filter((room) => room.positionX === 0 && room.positionZ === 0)
  if (atOrigin.length < 2) return []

  const placed: PlacedRoom[] = rooms.filter((room) => !atOrigin.includes(room) || room === atOrigin[0])
  return atOrigin.slice(1).map((room) => {
    const position = nextRoomPosition(placed)
    const moved = { ...room, positionX: position.x, positionZ: position.z }
    placed.push(moved)
    return moved
  })
}

type Candidate = { value: number; distance: number }

/**
 * Best correction along one axis: the moving room either shares a wall with another one
 * (its floor starts one wall thickness after the other's) or lines up with one of its edges.
 */
const snapAxis = (movingMin: number, movingMax: number, others: { min: number; max: number; wall: number }[]): number => {
  let best: Candidate = { value: 0, distance: SNAP_DISTANCE }
  for (const other of others) {
    const targets = [
      other.max + other.wall - movingMin,
      other.min - other.wall - movingMax,
      other.min - movingMin,
      other.max - movingMax,
    ]
    for (const value of targets) {
      if (Math.abs(value) < best.distance) best = { value, distance: Math.abs(value) }
    }
  }
  return best.value
}

/** Position of a dragged room once its walls snap against the walls of the other rooms. */
export const snapRoomPosition = (room: PlacedRoom, position: Point, others: PlacedRoom[]): Point => {
  const bounds = planBounds({ ...room, positionX: position.x, positionZ: position.z })
  const otherBounds = others.filter((other) => other.id !== room.id).map((other) => ({ bounds: planBounds(other), wall: other.wallThickness }))
  const dx = snapAxis(bounds.minX, bounds.maxX, otherBounds.map(({ bounds: b, wall }) => ({ min: b.minX, max: b.maxX, wall })))
  const dz = snapAxis(bounds.minZ, bounds.maxZ, otherBounds.map(({ bounds: b, wall }) => ({ min: b.minZ, max: b.maxZ, wall })))
  return { x: Math.round(position.x + dx), z: Math.round(position.z + dz) }
}
