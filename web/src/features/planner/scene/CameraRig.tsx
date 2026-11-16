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
import { mmToM } from '../../../lib/units'
import { boundsCenter, polygonBounds, type Point } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'

const TOP_VIEW_HEIGHT = 50
const TOP_VIEW_MARGIN = 1.25
const ORBIT_DISTANCE_FACTOR = 1.25
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.05
/** In 2D the left button draws (selection rectangle, walls), so it must not move the view. */
const NO_ACTION = -1 as MOUSE

type Props = {
  /** Changing this key re-frames the view (room id, or a fixed key while drawing). */
  frameKey: string
  /** Area to frame, in millimetres. */
  outline: Point[]
  ceilingHeight: number
}

export const CameraRig = ({ frameKey, outline, ceilingHeight }: Props) => {
  const viewMode = usePlannerStore((state) => state.viewMode)
  const isDragging = usePlannerStore((state) => state.isDragging)
  const frameRequest = usePlannerStore((state) => state.frameRequest)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const activeCamera = useThree((state) => state.camera)
  const perspectiveRef = useRef<PerspectiveCameraImpl>(null)
  const orthographicRef = useRef<OrthographicCameraImpl>(null)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const outlineRef = useRef(outline)
  outlineRef.current = outline
  const is2d = viewMode === '2d'

  // Frames the area when the room, the view mode or the viewport changes, or on demand.
  // The active camera is a dependency because drei rebuilds the controls when it changes.
  useEffect(() => {
    const controls = controlsRef.current
    const perspective = perspectiveRef.current
    const orthographic = orthographicRef.current
    if (!controls || !perspective || !orthographic) return

    const bounds = polygonBounds(outlineRef.current)
    const center = boundsCenter(bounds)
    const centerX = mmToM(center.x)
    const centerZ = mmToM(center.z)
    const areaWidth = mmToM(bounds.maxX - bounds.minX)
    const areaDepth = mmToM(bounds.maxZ - bounds.minZ)

    if (is2d) {
      orthographic.position.set(centerX, TOP_VIEW_HEIGHT, centerZ)
      orthographic.zoom = Math.min(size.width / (areaWidth * TOP_VIEW_MARGIN), size.height / (areaDepth * TOP_VIEW_MARGIN))
      orthographic.updateProjectionMatrix()
      controls.target.set(centerX, 0, centerZ)
    } else {
      const distance = Math.max(areaWidth, areaDepth) * ORBIT_DISTANCE_FACTOR
      perspective.position.set(centerX, distance * 0.9, centerZ + distance)
      controls.target.set(centerX, mmToM(ceilingHeight) / 4, centerZ)
    }
    controls.update()
    invalidate()
  }, [frameKey, ceilingHeight, is2d, frameRequest, size.width, size.height, invalidate, activeCamera])

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
