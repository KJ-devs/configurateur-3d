import { describe, expect, it } from 'vitest'
import {
  boundsCenter,
  clampToBounds,
  computeWalls,
  footprintCorners,
  footprintHalfExtents,
  polygonArea,
  polygonBounds,
  rectanglePolygon,
} from './geometry'

const room = rectanglePolygon(4000, 3000)

const expectPoint = (actual: { x: number; z: number }, x: number, z: number) => {
  expect(actual.x).toBeCloseTo(x, 6)
  expect(actual.z).toBeCloseTo(z, 6)
}

describe('polygon', () => {
  it('computes the area whatever the winding', () => {
    expect(polygonArea(room)).toBe(12_000_000)
    expect(polygonArea([...room].reverse())).toBe(12_000_000)
  })

  it('computes the area of an L-shaped room', () => {
    const lShape = [
      { x: 0, z: 0 },
      { x: 4000, z: 0 },
      { x: 4000, z: 2000 },
      { x: 2000, z: 2000 },
      { x: 2000, z: 4000 },
      { x: 0, z: 4000 },
    ]
    expect(polygonArea(lShape)).toBe(12_000_000)
  })

  it('computes bounds and their centre', () => {
    const bounds = polygonBounds(room)
    expect(bounds).toEqual({ minX: 0, maxX: 4000, minZ: 0, maxZ: 3000 })
    expect(boundsCenter(bounds)).toEqual({ x: 2000, z: 1500 })
  })
})

describe('computeWalls', () => {
  it('creates one wall per edge with outward normals', () => {
    const walls = computeWalls(room, 100)

    expect(walls).toHaveLength(4)
    expect(walls.map((wall) => wall.length)).toEqual([4000, 3000, 4000, 3000])
    expectPoint(walls[0].normal, 0, -1)
    expectPoint(walls[1].normal, 1, 0)
    expectPoint(walls[2].normal, 0, 1)
    expectPoint(walls[3].normal, -1, 0)
  })

  it('keeps outward normals for a clockwise polygon', () => {
    const walls = computeWalls([...room].reverse(), 100)

    walls.forEach((wall) => {
      const middle = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }
      const outside = { x: middle.x + wall.normal.x * 10, z: middle.z + wall.normal.z * 10 }
      const isOutside = outside.x < 0 || outside.x > 4000 || outside.z < 0 || outside.z > 3000
      expect(isOutside).toBe(true)
    })
  })

  it('places the wall body outside the floor and fills the end corner', () => {
    const [first, second] = computeWalls(room, 100)

    expect(first.bodyLength).toBe(4100)
    expectPoint(first.center, 2050, -50)
    expect(first.rotationY).toBeCloseTo(0, 6)
    expectPoint(second.center, 4050, 1550)
    expect(first.inwardZ).toBe(1)
    expect(computeWalls([...room].reverse(), 100)[0].inwardZ).toBe(-1)
    expect(second.rotationY).toBeCloseTo(-Math.PI / 2, 6)
  })
})

describe('footprint', () => {
  it('swaps half extents at 90°', () => {
    expect(footprintHalfExtents(2000, 800, 0)).toEqual({ halfX: 1000, halfZ: 400 })
    const rotated = footprintHalfExtents(2000, 800, 90)
    expect(rotated.halfX).toBeCloseTo(400, 6)
    expect(rotated.halfZ).toBeCloseTo(1000, 6)
  })

  it('grows the enclosing box at 45°', () => {
    const { halfX, halfZ } = footprintHalfExtents(1000, 1000, 45)
    expect(halfX).toBeCloseTo(Math.SQRT2 * 500, 6)
    expect(halfZ).toBeCloseTo(Math.SQRT2 * 500, 6)
  })

  it('rotates corners with the Three.js convention', () => {
    const corners = footprintCorners({ x: 1000, z: 1000 }, 2000, 800, 90)
    // local +X (right side) points to world -Z after a 90° rotation around Y
    expectPoint(corners[1], 600, 0)
    expectPoint(corners[3], 1400, 2000)
  })
})

describe('clampToBounds', () => {
  const bounds = polygonBounds(room)

  it('leaves a footprint that fits untouched', () => {
    expect(clampToBounds({ x: 2000, z: 1500 }, 500, 300, bounds)).toEqual({ x: 2000, z: 1500 })
  })

  it('pushes a footprint back inside the room', () => {
    expect(clampToBounds({ x: -200, z: 2900 }, 500, 300, bounds)).toEqual({ x: 500, z: 2700 })
    expect(clampToBounds({ x: 9000, z: -50 }, 500, 300, bounds)).toEqual({ x: 3500, z: 300 })
  })

  it('centres a footprint larger than the room', () => {
    expect(clampToBounds({ x: 100, z: 100 }, 2500, 300, bounds)).toEqual({ x: 2000, z: 300 })
  })
})
