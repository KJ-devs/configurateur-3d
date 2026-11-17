import { describe, expect, it } from 'vitest'
import { rectanglePolygon } from './geometry'
import { nextRoomPosition, planBounds, snapRoomPosition, spreadStackedRooms, type PlacedRoom } from './plan'

const room = (id: string, x: number, z: number): PlacedRoom => ({
  id,
  floorPolygon: rectanglePolygon(4000, 3000),
  positionX: x,
  positionZ: z,
  wallThickness: 100,
})

describe('nextRoomPosition', () => {
  it('starts at the origin, then goes to the right of the existing rooms', () => {
    expect(nextRoomPosition([])).toEqual({ x: 0, z: 0 })
    // Its floor starts one wall thickness after the other room's: the two rooms share that wall.
    expect(nextRoomPosition([room('a', 0, 0)])).toEqual({ x: 4000 + 100, z: 0 })
  })
})

describe('spreadStackedRooms', () => {
  it('lines up the rooms stacked at the origin and leaves the placed ones', () => {
    const moved = spreadStackedRooms([room('a', 0, 0), room('b', 0, 0), room('c', 0, 0), room('d', 0, 9000)])
    expect(moved.map((placed) => [placed.id, placed.positionX])).toEqual([
      ['b', 4100],
      ['c', 8200],
    ])
    expect(spreadStackedRooms([room('a', 0, 0), room('b', 5000, 0)])).toEqual([])
  })
})

describe('snapRoomPosition', () => {
  it('puts a nearby room against the other one, sharing the wall, and lines up their edges', () => {
    const living = room('living', 0, 0)
    const kitchen = room('kitchen', 0, 0)
    const snapped = snapRoomPosition(kitchen, { x: 4250, z: 120 }, [living])

    expect(snapped).toEqual({ x: 4100, z: 0 })
    expect(planBounds({ ...kitchen, positionX: snapped.x }).minX - planBounds(living).maxX).toBe(100)
  })

  it('leaves a room alone when nothing is close', () => {
    expect(snapRoomPosition(room('b', 0, 0), { x: 9000, z: 7000 }, [room('a', 0, 0)])).toEqual({ x: 9000, z: 7000 })
  })
})
