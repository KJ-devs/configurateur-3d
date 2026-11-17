import { describe, expect, it } from 'vitest'
import type { EditContext, PlacedItem } from './editing'
import { rectanglePolygon } from './geometry'
import type { WallOpening } from './openings'
import { fitItems, fitOpenings, moveWall, rectangleSize, resizeRectangle, setWallLength } from './roomEditing'

const room = rectanglePolygon(4000, 3000)
const contextFor = (polygon = room): EditContext<PlacedItem> => ({
  sizeOf: () => ({ width: 1000, depth: 500 }),
  polygon,
  wallThickness: 100,
  gridSize: 0,
})

describe('moveWall', () => {
  it('pushes a wall outwards along its normal', () => {
    // Wall 1 is the right wall (x = 4000), its outward normal points to +x.
    const { polygon } = moveWall(room, 1, 500)
    expect(rectangleSize(polygon)).toEqual({ width: 4500, depth: 3000 })
  })

  it('stops before the room becomes too small', () => {
    const { polygon } = moveWall(room, 1, -3900)
    const size = rectangleSize(polygon)
    expect(size?.width).toBeGreaterThanOrEqual(500)
    expect(size?.width).toBeLessThan(520)
  })
})

describe('setWallLength', () => {
  it('slides the next wall to give the new length', () => {
    expect(rectangleSize(setWallLength(room, 0, 5200)?.polygon ?? [])).toEqual({ width: 5200, depth: 3000 })
    expect(setWallLength(room, 0, 100)).toBeNull()
  })
})

describe('resizeRectangle', () => {
  it('keeps the corner order of the room', () => {
    expect(resizeRectangle(room, 5000, 3500)).toEqual(rectanglePolygon(5000, 3500))
  })
})

describe('fitOpenings', () => {
  const door: WallOpening = { id: 'd', kind: 'Door', wallIndex: 0, offset: 3000, width: 830, height: 2040, sillHeight: 0 }

  it('slides an opening back inside a shorter wall', () => {
    const [fitted] = fitOpenings([door], rectanglePolygon(2500, 3000))
    expect(fitted.offset + fitted.width).toBeLessThanOrEqual(2450)
  })

  it('drops an opening that no longer fits', () => {
    expect(fitOpenings([door], rectanglePolygon(380, 3000))).toEqual([])
  })
})

describe('fitItems', () => {
  it('moves the furniture standing against the moved wall and leaves the others', () => {
    const items: PlacedItem[] = [
      // Rotated a quarter turn, its 500 mm depth runs along x: its back touches the wall at x = 4000.
      { id: 'against', x: 3750, z: 1500, rotationY: 90 },
      { id: 'middle', x: 2000, z: 1500, rotationY: 0 },
    ]
    const move = moveWall(room, 1, 500)
    const [against, middle] = fitItems(items, room, move, contextFor(move.polygon))
    expect(against.x).toBe(4250)
    expect(middle.x).toBe(2000)
  })

  it('keeps furniture inside a room that shrinks', () => {
    const items: PlacedItem[] = [{ id: 'a', x: 2000, z: 1500, rotationY: 0 }]
    const move = moveWall(room, 1, -2000)
    const [item] = fitItems(items, room, move, contextFor(move.polygon))
    expect(item.x + 500).toBeLessThanOrEqual(2000)
  })
})
