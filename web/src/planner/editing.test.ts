import { describe, expect, it } from 'vitest'
import { footprintsOverlap } from './collision'
import {
  dragItems,
  duplicateItems,
  nudgeItems,
  placeItem,
  rotateItems,
  rotateItemTo,
  toFootprint,
  type EditContext,
  type PlacedItem,
} from './editing'
import { rectanglePolygon } from './geometry'

const size = { width: 1000, depth: 500 }
const context: EditContext<PlacedItem> = {
  sizeOf: () => size,
  polygon: rectanglePolygon(4000, 3000),
  wallThickness: 100,
  gridSize: 0,
}

const item = (id: string, x: number, z: number, rotationY = 0): PlacedItem => ({ id, x, z, rotationY })

describe('dragItems', () => {
  const snapshot = [item('a', 2000, 1500), item('b', 3000, 2000)]

  it('moves a single item by the delta', () => {
    const { items } = dragItems(snapshot, ['a'], { x: -300, z: 100 }, context, true)
    expect(items[0]).toEqual(item('a', 1700, 1600))
    expect(items[1]).toBe(snapshot[1])
  })

  it('snaps a single item against a wall and rotates it', () => {
    const { items } = dragItems(snapshot, ['a'], { x: 0, z: 1250 }, context, true)
    expect(items[0]).toEqual(item('a', 2000, 2750, 180))
  })

  it('only clamps when snapping is disabled', () => {
    const { items, guides } = dragItems(snapshot, ['a'], { x: 0, z: 1200 }, context, false)
    expect(items[0]).toEqual(item('a', 2000, 2700))
    expect(guides).toEqual([])
  })

  it('moves a group rigidly and stops it at the walls', () => {
    const { items } = dragItems(snapshot, ['a', 'b'], { x: 900, z: 0 }, context, true)
    expect(items.map((moved) => moved.x)).toEqual([2500, 3500])
    expect(items.map((moved) => moved.z)).toEqual([1500, 2000])
  })

  it('ignores unknown ids', () => {
    expect(dragItems(snapshot, ['zzz'], { x: 100, z: 100 }, context, true).items).toBe(snapshot)
  })
})

describe('rotation', () => {
  it('rotates by steps and wraps around', () => {
    const [rotated] = rotateItems([item('a', 2000, 1500, 270)], ['a'], 90, context)
    expect(rotated.rotationY).toBe(0)
  })

  it('pushes the item back inside when the rotated footprint sticks out', () => {
    const [rotated] = rotateItems([item('a', 2000, 250)], ['a'], 90, context)
    expect(rotated).toEqual(item('a', 2000, 500, 90))
  })

  it('sets an absolute rotation', () => {
    const [rotated] = rotateItemTo([item('a', 2000, 1500)], 'a', -15, context)
    expect(rotated.rotationY).toBe(345)
  })
})

describe('nudge and place', () => {
  it('nudges the selection and keeps it in the room', () => {
    const [nudged] = nudgeItems([item('a', 600, 1500)], ['a'], { x: -500, z: 0 }, context)
    expect(nudged.x).toBe(500)
  })

  it('places an item at an exact position', () => {
    const [placed] = placeItem([item('a', 2000, 1500)], 'a', { x: 612.4, z: 1000 }, context)
    expect(placed).toEqual(item('a', 612, 1000))
  })
})

describe('duplicateItems', () => {
  it('creates copies with new ids that do not overlap anything', () => {
    let counter = 0
    const { items, newIds } = duplicateItems([item('a', 2000, 1500)], ['a'], context, () => `copy-${++counter}`)

    expect(newIds).toEqual(['copy-1'])
    expect(items).toHaveLength(2)
    expect(footprintsOverlap(toFootprint(items[0], size), toFootprint(items[1], size))).toBe(false)
  })
})
