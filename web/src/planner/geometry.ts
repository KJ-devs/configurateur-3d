/** Floor-plane geometry in millimetres. Pure TS: no React, no Three.js. */

export type Point = { x: number; z: number }

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

export type Wall = {
  index: number
  start: Point
  end: Point
  length: number
  /** Unit vector pointing out of the room. */
  normal: Point
  /** Centre of the wall body, pushed outwards by half the thickness and extended to fill the end corner. */
  center: Point
  /** Length of the wall body including the corner fill. */
  bodyLength: number
  /** Rotation around the vertical axis (radians, Three.js convention) aligning local X with the wall. */
  rotationY: number
  /** Sign of the wall-local Z axis that points into the room once rotated by rotationY. */
  inwardZ: 1 | -1
}

const DEG_TO_RAD = Math.PI / 180

export const rectanglePolygon = (width: number, depth: number): Point[] => [
  { x: 0, z: 0 },
  { x: width, z: 0 },
  { x: width, z: depth },
  { x: 0, z: depth },
]

const signedArea = (polygon: Point[]): number =>
  polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return sum + (point.x * next.z - next.x * point.z)
  }, 0) / 2

/** Area in mm². */
export const polygonArea = (polygon: Point[]): number => Math.abs(signedArea(polygon))

export const polygonBounds = (polygon: Point[]): Bounds => ({
  minX: Math.min(...polygon.map((point) => point.x)),
  maxX: Math.max(...polygon.map((point) => point.x)),
  minZ: Math.min(...polygon.map((point) => point.z)),
  maxZ: Math.max(...polygon.map((point) => point.z)),
})

export const boundsCenter = (bounds: Bounds): Point => ({
  x: (bounds.minX + bounds.maxX) / 2,
  z: (bounds.minZ + bounds.maxZ) / 2,
})

/** Wall i joins point i to point i+1 and sits outside the floor polygon. */
export const computeWalls = (polygon: Point[], thickness: number): Wall[] => {
  const orientation = Math.sign(signedArea(polygon)) || 1

  return polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length]
    const length = Math.hypot(end.x - start.x, end.z - start.z)
    const direction = { x: (end.x - start.x) / length, z: (end.z - start.z) / length }
    const normal = { x: direction.z * orientation, z: -direction.x * orientation }
    const alongOffset = (length + thickness) / 2

    return {
      index,
      start,
      end,
      length,
      normal,
      center: {
        x: start.x + direction.x * alongOffset + (normal.x * thickness) / 2,
        z: start.z + direction.z * alongOffset + (normal.z * thickness) / 2,
      },
      bodyLength: length + thickness,
      rotationY: -Math.atan2(direction.z, direction.x),
      inwardZ: orientation > 0 ? 1 : -1,
    }
  })
}

/** Half extents of the axis-aligned box enclosing a rotated footprint. */
export const footprintHalfExtents = (width: number, depth: number, rotationDeg: number): { halfX: number; halfZ: number } => {
  const cos = Math.abs(Math.cos(rotationDeg * DEG_TO_RAD))
  const sin = Math.abs(Math.sin(rotationDeg * DEG_TO_RAD))
  return {
    halfX: (width * cos + depth * sin) / 2,
    halfZ: (width * sin + depth * cos) / 2,
  }
}

/** Corners of a rotated footprint, following the Three.js rotation convention around Y. */
export const footprintCorners = (center: Point, width: number, depth: number, rotationDeg: number): Point[] => {
  const cos = Math.cos(rotationDeg * DEG_TO_RAD)
  const sin = Math.sin(rotationDeg * DEG_TO_RAD)
  const corners: [number, number][] = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ]
  return corners.map(([localX, localZ]) => ({
    x: center.x + localX * cos + localZ * sin,
    z: center.z - localX * sin + localZ * cos,
  }))
}

const clampAxis = (value: number, half: number, min: number, max: number): number =>
  max - min < half * 2 ? (min + max) / 2 : Math.min(Math.max(value, min + half), max - half)

/** Keeps a footprint inside the bounds; a footprint larger than the bounds is centred. */
export const clampToBounds = (center: Point, halfX: number, halfZ: number, bounds: Bounds): Point => ({
  x: clampAxis(center.x, halfX, bounds.minX, bounds.maxX),
  z: clampAxis(center.z, halfZ, bounds.minZ, bounds.maxZ),
})

const INSIDE_MARGIN = 1

/** Even-odd ray casting. Points exactly on the outline are not reliable: shrink shapes before testing. */
export const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let isInside = false
  polygon.forEach((a, index) => {
    const b = polygon[(index + 1) % polygon.length]
    const crosses = a.z > point.z !== b.z > point.z && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    if (crosses) isInside = !isInside
  })
  return isInside
}

/** True when a convex shape (its corners in order) lies inside the polygon; touching the walls is allowed. */
export const isInsidePolygon = (corners: Point[], polygon: Point[]): boolean => {
  const center = {
    x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
    z: corners.reduce((sum, corner) => sum + corner.z, 0) / corners.length,
  }
  const shrunk = corners.map((corner) => {
    const distance = Math.hypot(corner.x - center.x, corner.z - center.z)
    const factor = distance > INSIDE_MARGIN ? (distance - INSIDE_MARGIN) / distance : 0
    return { x: center.x + (corner.x - center.x) * factor, z: center.z + (corner.z - center.z) * factor }
  })

  // A concave room corner can poke into the shape while every corner of the shape stays inside.
  const isPokedByRoomCorner = polygon.some((vertex) => pointInPolygon(vertex, shrunk))
  return !isPokedByRoomCorner && shrunk.every((corner) => pointInPolygon(corner, polygon))
}
