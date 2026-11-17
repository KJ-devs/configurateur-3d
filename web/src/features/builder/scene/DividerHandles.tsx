import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Plane, Vector3 } from 'three'
import type { Divider, Layout } from '../../../engine/layout'
import type { ParametricFurniture } from '../../../engine/schema'
import { moveDivider } from '../../../engine/tree'
import { formatCm, mmToM, mToMm } from '../../../lib/units'
import { useBuilderStore } from '../../../store/builderStore'

const ACCENT = '#2f6f5e'
const HIT_THICKNESS = 44
const HIT_DEPTH = 24
const BAR_THICKNESS = 8
const LEFT_BUTTON = 0

type DragStart = { position: number; furniture: ParametricFurniture; layout: Layout }

type HandleProps = {
  divider: Divider
  furniture: ParametricFurniture
  layout: Layout
  onDragChange: (isDragging: boolean) => void
}

/** Position along the divider's axis, in mm in the furniture frame, where the pointer meets the front plane. */
const pointerPosition = (event: ThreeEvent<PointerEvent>, furniture: ParametricFurniture, axis: Divider['axis']): number | null => {
  const front = new Plane(new Vector3(0, 0, -1), mmToM(furniture.depth / 2))
  const hit = event.ray.intersectPlane(front, new Vector3())
  if (!hit) return null
  return axis === 'x' ? mToMm(hit.x) + furniture.width / 2 : mToMm(hit.y)
}

const DividerHandle = ({ divider, furniture, layout, onDragChange }: HandleProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<DragStart | null>(null)
  const { rect, axis } = divider
  const isVertical = axis === 'x'
  const center: [number, number, number] = [mmToM(rect.x + rect.w / 2), mmToM(rect.y + rect.h / 2), mmToM(furniture.depth)]
  const hitSize: [number, number, number] = isVertical
    ? [mmToM(HIT_THICKNESS), mmToM(rect.h), mmToM(HIT_DEPTH)]
    : [mmToM(rect.w), mmToM(HIT_THICKNESS), mmToM(HIT_DEPTH)]
  const barSize: [number, number, number] = isVertical
    ? [mmToM(BAR_THICKNESS), mmToM(rect.h), mmToM(2)]
    : [mmToM(rect.w), mmToM(BAR_THICKNESS), mmToM(2)]
  const lengths = layout.splitLengths[divider.splitId] ?? []
  const cursor = isVertical ? 'col-resize' : 'row-resize'

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== LEFT_BUTTON) return
    event.stopPropagation()
    const position = pointerPosition(event, furniture, axis)
    if (position === null) return

    dragStart.current = { position, furniture, layout }
    ;(event.target as Element).setPointerCapture(event.pointerId)
    setIsDragging(true)
    onDragChange(true)
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const start = dragStart.current
    const position = start && pointerPosition(event, start.furniture, axis)
    if (!start || position === null) return
    event.stopPropagation()

    const delta = Math.round(position - start.position)
    useBuilderStore.getState().edit(() => moveDivider(start.furniture, start.layout, divider, delta), `divider:${divider.key}`)
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!dragStart.current) return
    dragStart.current = null
    ;(event.target as Element).releasePointerCapture(event.pointerId)
    useBuilderStore.getState().endGesture()
    setIsDragging(false)
    onDragChange(false)
  }

  const isActive = isHovered || isDragging
  return (
    <group position={center}>
      <mesh
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={(event) => {
          event.stopPropagation()
          setIsHovered(true)
          document.body.style.cursor = cursor
        }}
        onPointerOut={() => {
          setIsHovered(false)
          if (!dragStart.current) document.body.style.cursor = 'auto'
        }}
      >
        <boxGeometry args={hitSize} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {isActive && (
        <mesh raycast={() => null}>
          <boxGeometry args={barSize} />
          <meshBasicMaterial color={ACCENT} />
        </mesh>
      )}
      {isDragging && (
        <Html center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
          <span className="flex whitespace-nowrap rounded-full bg-stone-900/85 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {formatCm(lengths[divider.index] ?? 0)}
            <span className="px-1.5 text-white/50">{isVertical ? '|' : '/'}</span>
            {formatCm(lengths[divider.index + 1] ?? 0)}
          </span>
        </Html>
      )}
    </group>
  )
}

type Props = { furniture: ParametricFurniture; layout: Layout; onDragChange: (isDragging: boolean) => void }

/** Grips over the separators: drag one to resize the compartments on both sides. */
export const DividerHandles = ({ furniture, layout, onDragChange }: Props) =>
  layout.dividers.map((divider) => (
    <DividerHandle key={divider.key} divider={divider} furniture={furniture} layout={layout} onDragChange={onDragChange} />
  ))
