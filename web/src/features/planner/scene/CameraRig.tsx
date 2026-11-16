import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import {
  MOUSE,
  TOUCH,
  type OrthographicCamera as OrthographicCameraImpl,
  type PerspectiveCamera as PerspectiveCameraImpl,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { RoomDto } from '../../../api/generated/model'
import { mmToM } from '../../../lib/units'
import { boundsCenter, polygonBounds } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'

const TOP_VIEW_HEIGHT = 50
const TOP_VIEW_MARGIN = 1.25
const ORBIT_DISTANCE_FACTOR = 1.25
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.05
/** In 2D the left button draws the selection rectangle, so it must not move the view. */
const NO_ACTION = -1 as MOUSE

type Props = { room: RoomDto }

export const CameraRig = ({ room }: Props) => {
  const viewMode = usePlannerStore((state) => state.viewMode)
  const isDragging = usePlannerStore((state) => state.isDragging)
  const frameRequest = usePlannerStore((state) => state.frameRequest)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const activeCamera = useThree((state) => state.camera)
  const perspectiveRef = useRef<PerspectiveCameraImpl>(null)
  const orthographicRef = useRef<OrthographicCameraImpl>(null)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const is2d = viewMode === '2d'

  // Frames the room when the room, the view mode or the viewport changes, or on demand.
  // The active camera is a dependency because drei rebuilds the controls when it changes.
  useEffect(() => {
    const controls = controlsRef.current
    const perspective = perspectiveRef.current
    const orthographic = orthographicRef.current
    if (!controls || !perspective || !orthographic) return

    const bounds = polygonBounds(room.floorPolygon)
    const center = boundsCenter(bounds)
    const centerX = mmToM(center.x)
    const centerZ = mmToM(center.z)
    const roomWidth = mmToM(bounds.maxX - bounds.minX)
    const roomDepth = mmToM(bounds.maxZ - bounds.minZ)

    if (is2d) {
      orthographic.position.set(centerX, TOP_VIEW_HEIGHT, centerZ)
      orthographic.zoom = Math.min(size.width / (roomWidth * TOP_VIEW_MARGIN), size.height / (roomDepth * TOP_VIEW_MARGIN))
      orthographic.updateProjectionMatrix()
      controls.target.set(centerX, 0, centerZ)
    } else {
      const distance = Math.max(roomWidth, roomDepth) * ORBIT_DISTANCE_FACTOR
      perspective.position.set(centerX, distance * 0.9, centerZ + distance)
      controls.target.set(centerX, mmToM(room.ceilingHeight) / 4, centerZ)
    }
    controls.update()
    invalidate()
  }, [room.id, room.floorPolygon, room.ceilingHeight, is2d, frameRequest, size.width, size.height, invalidate, activeCamera])

  return (
    <>
      <PerspectiveCamera ref={perspectiveRef} makeDefault={!is2d} fov={45} near={0.1} far={300} />
      <OrthographicCamera ref={orthographicRef} makeDefault={is2d} near={0.1} far={300} up={[0, 0, -1]} />
      <OrbitControls
        key={viewMode}
        ref={controlsRef}
        makeDefault
        enabled={!isDragging}
        enableRotate={!is2d}
        screenSpacePanning={is2d}
        maxPolarAngle={is2d ? Math.PI : MAX_POLAR_ANGLE}
        minDistance={1}
        maxDistance={60}
        minZoom={15}
        maxZoom={600}
        mouseButtons={{ LEFT: is2d ? NO_ACTION : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
        touches={{ ONE: is2d ? TOUCH.PAN : TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      />
    </>
  )
}
