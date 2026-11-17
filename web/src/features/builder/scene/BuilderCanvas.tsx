import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { mmToM } from '../../../lib/units'
import { useBuilderStore } from '../../../store/builderStore'
import { usePlannerStore } from '../../../store/plannerStore'
import { ParametricMesh } from '../../furniture/ParametricMesh'
import { useBuilderLayout } from '../useBuilderLayout'
import { CellPickers } from './CellPickers'
import { DividerHandles } from './DividerHandles'

const BACKGROUND_COLOR = '#f1efea'
const FOV = 40
const FRAME_MARGIN = 1.5
const CLICK_MAX_DISTANCE_PX = 4
const DEFAULT_COLOR = '#c8a97e'

type CameraProps = { width: number; height: number; frameKey: number; isDragging: boolean }

/** Front three-quarter view that fits the whole piece; re-framed when `frameKey` changes. */
const BuilderCamera = ({ width, height, frameKey, isDragging }: CameraProps) => {
  const cameraRef = useRef<PerspectiveCameraImpl>(null)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  // The controls register themselves after the first render: framing must wait for them.
  const defaultControls = useThree((state) => state.controls)
  // Read by the framing effect without making every resize re-frame the view.
  const dimensions = useRef({ width, height })
  useEffect(() => {
    dimensions.current = { width, height }
  })

  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    const w = mmToM(dimensions.current.width)
    const h = mmToM(dimensions.current.height)
    const halfFov = (FOV * Math.PI) / 360
    const aspect = size.width / Math.max(size.height, 1)
    const distance = (Math.max(h, w / aspect) * FRAME_MARGIN) / (2 * Math.tan(halfFov))
    camera.position.set(distance * 0.3, h / 2 + distance * 0.18, distance)
    controls.target.set(0, h / 2, 0)
    controls.update()
    invalidate()
  }, [frameKey, size.width, size.height, invalidate, defaultControls])

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault fov={FOV} near={0.05} far={100} />
      <OrbitControls ref={controlsRef} makeDefault enabled={!isDragging} enableDamping={false} minDistance={0.5} maxDistance={20} maxPolarAngle={Math.PI / 2 - 0.02} />
    </>
  )
}

const FurnitureScene = ({ onDragChange }: { onDragChange: (isDragging: boolean) => void }) => {
  const builder = useBuilderLayout()
  const showFronts = useBuilderStore((state) => state.showFronts)
  const color = usePlannerStore((state) => (builder ? state.materials[builder.furniture.materialId]?.colorHex : undefined))
  const warningIds = useMemo(() => new Set(builder?.issues.map((issue) => issue.cellId)), [builder])
  if (!builder) return null

  const { furniture, layout } = builder
  return (
    <group position={[-mmToM(furniture.width / 2), 0, -mmToM(furniture.depth / 2)]}>
      <ParametricMesh furniture={furniture} color={furniture.color ?? color ?? DEFAULT_COLOR} showFronts={showFronts} />
      <CellPickers furniture={furniture} layout={layout} warningIds={warningIds} />
      <DividerHandles furniture={furniture} layout={layout} onDragChange={onDragChange} />
    </group>
  )
}

type Props = { frameKey: number }

export const BuilderCanvas = ({ frameKey }: Props) => {
  const width = useBuilderStore((state) => state.furniture?.width ?? 0)
  const height = useBuilderStore((state) => state.furniture?.height ?? 0)
  const [isDragging, setIsDragging] = useState(false)
  const pointerDown = useRef({ x: 0, y: 0 })

  const rememberPointer = (event: PointerEvent) => {
    pointerDown.current = { x: event.clientX, y: event.clientY }
  }

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      onPointerDown={rememberPointer}
      onPointerMissed={(event) => {
        const distance = Math.hypot(event.clientX - pointerDown.current.x, event.clientY - pointerDown.current.y)
        if (distance <= CLICK_MAX_DISTANCE_PX) useBuilderStore.getState().selectCell(null)
      }}
    >
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <ambientLight intensity={1} />
      <directionalLight position={[3, 6, 5]} intensity={1.4} />
      <directionalLight position={[-4, 3, -2]} intensity={0.35} />
      <BuilderCamera width={width} height={height} frameKey={frameKey} isDragging={isDragging} />
      <FurnitureScene onDragChange={setIsDragging} />
      <ContactShadows position-y={-0.001} opacity={0.35} scale={8} blur={2.4} far={3} />
    </Canvas>
  )
}
