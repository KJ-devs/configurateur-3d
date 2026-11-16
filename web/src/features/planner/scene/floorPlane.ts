import { Plane, Vector3, type Ray } from 'three'
import type { Point } from '../../../planner/geometry'
import { mToMm } from '../../../lib/units'

const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()

/** Where a picking ray meets the floor, in millimetres. Null when the ray never reaches it. */
export const rayToFloor = (ray: Ray): Point | null =>
  ray.intersectPlane(FLOOR_PLANE, hit) ? { x: mToMm(hit.x), z: mToMm(hit.z) } : null
