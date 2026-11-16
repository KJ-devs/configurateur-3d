import { describe, expect, it } from 'vitest'
import { findFreePosition, isFootprintInside, footprintsOverlap, type Footprint } from './collision'
import { dragItems, type EditContext, type PlacedItem } from './editing'
import { computeWalls, isInsidePolygon, pointInPolygon, polygonBounds, rectanglePolygon } from './geometry'
import {
  findOpeningSpot,
  nearestWall,
  openingCenter,
  openingClearance,
  placeOpening,
  wallSegments,
  type WallOpening,
} from './openings'
import {
  isClosingPoint,
  isValidOutline,
  normalizeOutline,
  pointAtLength,
  snapDrawPoint,
  snapFirstPoint,
  snappedDirection,
  wouldCross,
} from './wallDrawing'

const lShape = [
  { x: 0, z: 0 },
  { x: 4000, z: 0 },
  { x: 4000, z: 2000 },
  { x: 2000, z: 2000 },
  { x: 2000, z: 4000 },
  { x: 0, z: 4000 },
]

const footprint = (x: number, z: number, width = 1000, depth = 500, rotation = 0): Footprint => ({
  id: 'f',
  center: { x, z },
  width,
  depth,
  rotation,
})

describe('wall drawing', () => {
  const origin = { x: 0, z: 0 }

  it('snaps the direction to multiples of 45°', () => {
    const horizontal = snappedDirection(origin, { x: 1000, z: 120 })
    const diagonal = snappedDirection(origin, { x: 1000, z: 800 })
    const vertical = snappedDirection(origin, { x: -90, z: -1000 })

    expect(horizontal.x).toBeCloseTo(1, 6)
    expect(horizontal.z).toBeCloseTo(0, 6)
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 6)
    expect(diagonal.z).toBeCloseTo(Math.SQRT1_2, 6)
    expect(vertical.x).toBeCloseTo(0, 6)
    expect(vertical.z).toBeCloseTo(-1, 6)
  })

  it('rounds the wall length to the grid', () => {
    expect(snapDrawPoint(origin, { x: 3018, z: 90 }, 50)).toEqual({ x: 3000, z: 0 })
    expect(snapDrawPoint({ x: 500, z: 500 }, { x: 520, z: 2777 }, 100)).toEqual({ x: 500, z: 2800 })
  })

  it('keeps the exact projected length without grid', () => {
    expect(snapDrawPoint(origin, { x: 3018, z: 90 }, 0)).toEqual({ x: 3018, z: 0 })
  })

  it('places a point at a typed length along the current direction', () => {
    const direction = snappedDirection(origin, { x: 10, z: 1000 })
    expect(pointAtLength({ x: 200, z: 300 }, direction, 2500)).toEqual({ x: 200, z: 2800 })
  })

  it('rounds the first point to the grid', () => {
    expect(snapFirstPoint({ x: 1234, z: -1277 }, 50)).toEqual({ x: 1250, z: -1300 })
    expect(snapFirstPoint({ x: 1234.4, z: 10.6 }, 0)).toEqual({ x: 1234, z: 11 })
  })

  it('closes the outline near the first point once there are three corners', () => {
    const corners = [origin, { x: 3000, z: 0 }, { x: 3000, z: 2000 }]
    expect(isClosingPoint(corners, { x: 80, z: -60 }, 150)).toBe(true)
    expect(isClosingPoint(corners, { x: 800, z: 0 }, 150)).toBe(false)
    expect(isClosingPoint(corners.slice(0, 2), { x: 0, z: 0 }, 150)).toBe(false)
  })

  it('validates outlines', () => {
    const bowTie = [origin, { x: 2000, z: 2000 }, { x: 2000, z: 0 }, { x: 0, z: 2000 }]
    const withTinyWall = [origin, { x: 2000, z: 0 }, { x: 2000, z: 50 }, { x: 0, z: 2000 }]

    expect(isValidOutline(rectanglePolygon(3000, 2000))).toBe(true)
    expect(isValidOutline(lShape)).toBe(true)
    expect(isValidOutline(bowTie)).toBe(false)
    expect(isValidOutline(withTinyWall)).toBe(false)
    expect(isValidOutline([origin, { x: 1000, z: 0 }])).toBe(false)
  })

  it('detects a new wall crossing a drawn one', () => {
    const drawn = [origin, { x: 3000, z: 0 }, { x: 3000, z: 2000 }, { x: 1000, z: 2000 }]
    expect(wouldCross(drawn, { x: 1000, z: -500 })).toBe(true)
    expect(wouldCross(drawn, { x: 1000, z: 500 })).toBe(false)
  })

  it('moves the outline to the origin', () => {
    const outline = [{ x: -500, z: 300 }, { x: 2500, z: 300 }, { x: 2500, z: 2300 }]
    expect(normalizeOutline(outline)).toEqual([{ x: 0, z: 0 }, { x: 3000, z: 0 }, { x: 3000, z: 2000 }])
  })
})

describe('polygon containment', () => {
  it('tests points against a concave polygon', () => {
    expect(pointInPolygon({ x: 1000, z: 3000 }, lShape)).toBe(true)
    expect(pointInPolygon({ x: 3000, z: 3000 }, lShape)).toBe(false)
  })

  it('accepts a footprint flush against the walls', () => {
    expect(isFootprintInside(footprint(500, 250), lShape)).toBe(true)
  })

  it('rejects a footprint in the notch of an L-shaped room', () => {
    expect(isFootprintInside(footprint(3000, 3000), lShape)).toBe(false)
    expect(isFootprintInside(footprint(2200, 2100), lShape)).toBe(false)
  })

  it('rejects a shape poked by the inner corner even when its corners are inside', () => {
    const corners = [{ x: 1500, z: 1500 }, { x: 2500, z: 1500 }, { x: 2500, z: 1900 }, { x: 1500, z: 2500 }]
    expect(isInsidePolygon(corners, lShape)).toBe(false)
  })

  it('finds a free position inside the polygon, not just inside its bounds', () => {
    const position = findFreePosition(footprint(3000, 3000), [], polygonBounds(lShape), 100, lShape)
    expect(isFootprintInside(footprint(position.x, position.z), lShape)).toBe(true)
  })

  it('stops a dragged item at the notch of an L-shaped room', () => {
    const context: EditContext<PlacedItem> = { sizeOf: () => ({ width: 1000, depth: 500 }), polygon: lShape, wallThickness: 100, gridSize: 0 }
    const snapshot = [{ id: 'a', x: 1000, z: 3000, rotationY: 0 }]

    const { items } = dragItems(snapshot, ['a'], { x: 1500, z: 0 }, context, false)

    expect(items[0].x).toBeLessThanOrEqual(1500)
    expect(items[0].x).toBeGreaterThan(1400)
  })
})

describe('openings', () => {
  const walls = computeWalls(rectanglePolygon(4000, 3000), 100)
  const door = (overrides: Partial<WallOpening> = {}): WallOpening => ({
    id: 'door',
    kind: 'Door',
    wallIndex: 0,
    offset: 1000,
    width: 830,
    height: 2040,
    sillHeight: 0,
    ...overrides,
  })

  it('finds the wall nearest to a point', () => {
    const nearest = nearestWall({ x: 3900, z: 1200 }, walls)
    expect(nearest?.wall.index).toBe(1)
    expect(nearest?.along).toBeCloseTo(1200, 6)
    expect(nearest?.distance).toBeCloseTo(100, 6)
  })

  it('clips an opening into the nearest wall, centred on the pointer', () => {
    expect(placeOpening({ x: 2000, z: 200 }, 830, walls, [])).toEqual({ wallIndex: 0, offset: 1585 })
  })

  it('keeps the opening away from the wall ends', () => {
    expect(placeOpening({ x: 100, z: 0 }, 830, walls, [])).toEqual({ wallIndex: 0, offset: 50 })
    expect(placeOpening({ x: 3990, z: 0 }, 830, walls, [])).toEqual({ wallIndex: 0, offset: 3120 })
  })

  it('refuses a spot taken by another opening or too far from any wall', () => {
    expect(placeOpening({ x: 1500, z: 0 }, 830, walls, [door()])).toBeNull()
    expect(placeOpening({ x: 1500, z: 0 }, 830, walls, [door({ wallIndex: 2 })])).not.toBeNull()
    expect(placeOpening({ x: 2000, z: 1500 }, 830, walls, [], 500)).toBeNull()
  })

  it('refuses a wall shorter than the opening', () => {
    const shortWalls = computeWalls(rectanglePolygon(600, 600), 100)
    expect(placeOpening({ x: 300, z: 0 }, 830, shortWalls, [])).toBeNull()
  })

  it('finds a free spot on the longest wall first', () => {
    const first = findOpeningSpot(830, walls, [])
    expect(first).toEqual({ wallIndex: 0, offset: 1585 })
    const second = findOpeningSpot(830, walls, [door({ offset: 1585 })])
    expect(second).not.toBeNull()
    expect(second).not.toEqual(first)
  })

  it('computes the centre of an opening on its wall', () => {
    expect(openingCenter(door(), walls[0])).toEqual({ x: 1415, z: 0 })
    const onRightWall = openingCenter(door({ wallIndex: 1 }), walls[1])
    expect(onRightWall.x).toBeCloseTo(4000, 6)
    expect(onRightWall.z).toBeCloseTo(1415, 6)
  })

  it('cuts a door out of a wall', () => {
    expect(wallSegments(4100, 2500, [door()])).toEqual([
      { x0: 0, x1: 1000, y0: 0, y1: 2500 },
      { x0: 1000, x1: 1830, y0: 2040, y1: 2500 },
      { x0: 1830, x1: 4100, y0: 0, y1: 2500 },
    ])
  })

  it('cuts a window out of a wall, keeping the sill and the lintel', () => {
    const window = door({ kind: 'Window', offset: 500, width: 1200, height: 1250, sillHeight: 900 })
    expect(wallSegments(4100, 2500, [window])).toEqual([
      { x0: 0, x1: 500, y0: 0, y1: 2500 },
      { x0: 500, x1: 1700, y0: 0, y1: 900 },
      { x0: 500, x1: 1700, y0: 2150, y1: 2500 },
      { x0: 1700, x1: 4100, y0: 0, y1: 2500 },
    ])
  })

  it('returns the whole wall when there is no opening', () => {
    expect(wallSegments(4100, 2500, [])).toEqual([{ x0: 0, x1: 4100, y0: 0, y1: 2500 }])
  })

  it('reserves the swing of a door inside the room', () => {
    const clearance = openingClearance(door(), walls[0])
    expect(clearance.center.x).toBeCloseTo(1415, 6)
    expect(clearance.center.z).toBeCloseTo(415, 6)
    expect(footprintsOverlap(clearance, footprint(1400, 400))).toBe(true)
    expect(footprintsOverlap(clearance, footprint(1400, 1200))).toBe(false)
  })

  it('reserves only a thin strip under a window', () => {
    const window = door({ kind: 'Window', sillHeight: 900 })
    expect(openingClearance(window, walls[0]).depth).toBe(100)
  })
})
