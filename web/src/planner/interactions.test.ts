import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, recordCommand, redoCommand, undoCommand, type Command, type HistoryStacks } from '../store/history'
import { findCollisions, findFreePosition, footprintBounds, footprintsOverlap, unionBounds, type Footprint } from './collision'
import { centerForWallDistance, wallDistances } from './dimensions'
import { computeWalls, polygonBounds, rectanglePolygon } from './geometry'
import { snapMove, type SnapInput } from './snapping'

const roomPolygon = rectanglePolygon(4000, 3000)
const walls = computeWalls(roomPolygon, 100)
const bounds = polygonBounds(roomPolygon)

const footprint = (id: string, x: number, z: number, rotation = 0, width = 1000, depth = 500): Footprint => ({
  id,
  center: { x, z },
  width,
  depth,
  rotation,
})

describe('footprintsOverlap', () => {
  it('detects overlapping axis-aligned footprints', () => {
    expect(footprintsOverlap(footprint('a', 1000, 1000), footprint('b', 1500, 1200))).toBe(true)
  })

  it('treats touching footprints as not overlapping', () => {
    expect(footprintsOverlap(footprint('a', 1000, 1000), footprint('b', 2000, 1000))).toBe(false)
    expect(footprintsOverlap(footprint('a', 1000, 1000), footprint('b', 1000, 1500))).toBe(false)
  })

  it('uses the oriented boxes, not their enclosing boxes', () => {
    const diagonal = footprint('a', 1000, 1000, 45, 2000, 200)
    const inEmptyCorner = footprint('b', 1650, 1650, 0, 300, 300)
    const onTheDiagonal = footprint('c', 1400, 600, 0, 300, 300)

    expect(footprintsOverlap(diagonal, inEmptyCorner)).toBe(false)
    expect(footprintsOverlap(diagonal, onTheDiagonal)).toBe(true)
  })

  it('lists every footprint involved in a collision', () => {
    const colliding = findCollisions([footprint('a', 1000, 1000), footprint('b', 1200, 1000), footprint('c', 3500, 2500)])
    expect([...colliding].sort()).toEqual(['a', 'b'])
  })

  it('computes enclosing and union bounds', () => {
    const rotated = footprintBounds(footprint('a', 1000, 1000, 90))
    expect(rotated.minX).toBeCloseTo(750, 6)
    expect(rotated.maxZ).toBeCloseTo(1500, 6)
    expect(unionBounds([footprintBounds(footprint('a', 1000, 1000)), footprintBounds(footprint('b', 3000, 2000))])).toEqual({
      minX: 500,
      maxX: 3500,
      minZ: 750,
      maxZ: 2250,
    })
  })
})

describe('findFreePosition', () => {
  it('keeps the wanted position when it is free', () => {
    expect(findFreePosition(footprint('m', 2000, 1500), [], bounds, 200)).toEqual({ x: 2000, z: 1500 })
  })

  it('moves next to an obstacle occupying the wanted position', () => {
    const obstacle = footprint('o', 2000, 1500)
    const position = findFreePosition(footprint('m', 2000, 1500), [obstacle], bounds, 200)

    expect(position).not.toEqual({ x: 2000, z: 1500 })
    expect(footprintsOverlap(footprint('m', position.x, position.z), obstacle)).toBe(false)
  })

  it('never leaves the room', () => {
    const obstacle = footprint('o', 500, 250)
    const position = findFreePosition(footprint('m', 500, 250), [obstacle], bounds, 200)

    expect(position.x).toBeGreaterThanOrEqual(500)
    expect(position.z).toBeGreaterThanOrEqual(250)
  })

  it('falls back to the wanted position when the room is full', () => {
    const wall = footprint('o', 2000, 1500, 0, 4000, 3000)
    expect(findFreePosition(footprint('m', 2000, 1500), [wall], bounds, 200)).toEqual({ x: 2000, z: 1500 })
  })
})

describe('snapMove', () => {
  const snap = (overrides: Partial<SnapInput>): ReturnType<typeof snapMove> =>
    snapMove({ moving: footprint('m', 2000, 1500), walls, others: [], bounds, gridSize: 0, ...overrides })

  it('leaves a free position untouched without grid', () => {
    const result = snap({ moving: footprint('m', 2013, 1507) })
    expect(result).toEqual({ position: { x: 2013, z: 1507 }, rotation: 0, guides: [] })
  })

  it('puts the back against the top wall, facing the room', () => {
    const result = snap({ moving: footprint('m', 2000, 330, 90) })
    expect(result.rotation).toBe(0)
    expect(result.position.x).toBeCloseTo(2000, 6)
    expect(result.position.z).toBeCloseTo(250, 6)
  })

  it('rotates the furniture to face the room on each wall', () => {
    expect(snap({ moving: footprint('m', 3700, 1500) }).rotation).toBe(270)
    expect(snap({ moving: footprint('m', 2000, 2700) }).rotation).toBe(180)
    expect(snap({ moving: footprint('m', 300, 1500) }).rotation).toBe(90)
  })

  it('keeps the furniture flush when the pointer goes slightly outside the room', () => {
    const result = snap({ moving: footprint('m', 3700, 1500) })
    expect(result.position.x).toBeCloseTo(3750, 6)
    expect(result.position.z).toBeCloseTo(1500, 6)
  })

  it('stops at the corner when sliding along a wall', () => {
    const result = snap({ moving: footprint('m', 100, 300) })
    expect(result.rotation).toBe(90)
    expect(result.position.x).toBeCloseTo(250, 6)
    expect(result.position.z).toBeCloseTo(500, 6)
  })

  it('aligns an edge with another furniture and reports a guide', () => {
    const other = footprint('o', 1000, 1500)
    const result = snap({ moving: footprint('m', 1030, 2400), others: [other] })

    expect(result.position.x).toBe(1000)
    expect(result.guides).toContainEqual({ axis: 'x', value: 500, from: 1250, to: 2650 })
  })

  it('butts the moving furniture against the side of another one', () => {
    const other = footprint('o', 1000, 1500)
    const result = snap({ moving: footprint('m', 2040, 1500), others: [other] })
    expect(result.position.x).toBe(2000)
  })

  it('snaps the lower edge to the grid when nothing else attracts it', () => {
    const result = snap({ moving: footprint('m', 2013, 1532), gridSize: 50 })
    expect(result.position).toEqual({ x: 2000, z: 1550 })
  })

  it('prefers the alignment over the grid', () => {
    const other = footprint('o', 1000, 1513)
    const result = snap({ moving: footprint('m', 2600, 1530), others: [other], gridSize: 50 })
    expect(result.position.z).toBe(1513)
  })

  it('keeps the result inside the room', () => {
    const result = snap({ moving: footprint('m', 2000, 1500, 0, 5000, 500) })
    expect(result.position.x).toBe(2000)
  })
})

describe('wall distances', () => {
  it('measures the clear distance on the four sides', () => {
    const distances = wallDistances({ x: 1000, z: 1000 }, 500, 250, roomPolygon)
    const byDirection = Object.fromEntries(distances.map((item) => [item.direction, item.distance]))

    expect(byDirection).toEqual({ left: 500, right: 2500, up: 750, down: 1750 })
  })

  it('stops at the nearest wall of an L-shaped room', () => {
    const lShape = [
      { x: 0, z: 0 },
      { x: 4000, z: 0 },
      { x: 4000, z: 2000 },
      { x: 2000, z: 2000 },
      { x: 2000, z: 4000 },
      { x: 0, z: 4000 },
    ]
    const distances = wallDistances({ x: 1000, z: 3000 }, 200, 200, lShape)
    expect(distances.find((item) => item.direction === 'right')?.distance).toBe(800)
  })

  it('computes the centre matching a typed distance', () => {
    const center = { x: 1000, z: 1000 }
    const distances = wallDistances(center, 500, 250, roomPolygon)
    const left = distances.find((item) => item.direction === 'left')!
    const down = distances.find((item) => item.direction === 'down')!

    expect(centerForWallDistance(center, left, 100)).toEqual({ x: 600, z: 1000 })
    expect(centerForWallDistance(center, down, 0)).toEqual({ x: 1000, z: 2750 })
  })
})

describe('history', () => {
  const empty: HistoryStacks = { past: [], future: [] }

  const counterCommand = (state: { value: number }, delta: number): Command => ({
    label: `add ${delta}`,
    undo: () => (state.value -= delta),
    redo: () => (state.value += delta),
  })

  it('undoes and redoes in order', () => {
    const state = { value: 0 }
    const first = counterCommand(state, 1)
    const second = counterCommand(state, 10)
    first.redo()
    second.redo()
    let stacks = recordCommand(recordCommand(empty, first), second)

    stacks = undoCommand(stacks)
    expect(state.value).toBe(1)
    stacks = undoCommand(stacks)
    expect(state.value).toBe(0)
    stacks = redoCommand(stacks)
    expect(state.value).toBe(1)
    expect(stacks.past).toHaveLength(1)
    expect(stacks.future).toHaveLength(1)
  })

  it('drops the redo branch when a new command is recorded', () => {
    const state = { value: 0 }
    let stacks = recordCommand(empty, counterCommand(state, 1))
    stacks = undoCommand(stacks)
    stacks = recordCommand(stacks, counterCommand(state, 5))

    expect(stacks.future).toHaveLength(0)
    expect(redoCommand(stacks)).toBe(stacks)
  })

  it('does nothing when there is nothing to undo', () => {
    expect(undoCommand(empty)).toBe(empty)
  })

  it('caps the number of remembered commands', () => {
    const state = { value: 0 }
    let stacks = empty
    for (let index = 0; index < HISTORY_LIMIT + 20; index++) stacks = recordCommand(stacks, counterCommand(state, 1))
    expect(stacks.past).toHaveLength(HISTORY_LIMIT)
  })
})
