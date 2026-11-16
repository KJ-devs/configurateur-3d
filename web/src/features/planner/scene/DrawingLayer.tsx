import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { formatCm, mmToM } from '../../../lib/units'
import type { Point } from '../../../planner/geometry'
import {
  isClosingPoint,
  isValidOutline,
  pointAtLength,
  snapDrawPoint,
  snapFirstPoint,
  snappedDirection,
  wouldCross,
} from '../../../planner/wallDrawing'
import { usePlannerStore } from '../../../store/plannerStore'
import { FloorLine } from './FloorLine'
import { rayToFloor } from './floorPlane'

const CATCHER_SIZE = 400
const WALL_COLOR = '#44403c'
const PREVIEW_COLOR = '#2f6f5e'
const INVALID_COLOR = '#dc2626'
const WALL_WIDTH = 0.08
const CLOSE_TOLERANCE = 250
const MM_PER_CM = 10
const CLICK_MAX_DISTANCE_PX = 4
const ignoreRaycast = () => null

const Corner = ({ point, color, radius = 0.07 }: { point: Point; color: string; radius?: number }) => (
  <mesh position={[mmToM(point.x), 0.03, mmToM(point.z)]} rotation-x={-Math.PI / 2} raycast={ignoreRaycast} renderOrder={3}>
    <circleGeometry args={[radius, 24]} />
    <meshBasicMaterial color={color} depthTest={false} />
  </mesh>
)

/** Free-hand drawing of a room outline: click to add corners, type a length, close on the first corner. */
export const DrawingLayer = () => {
  const points = usePlannerStore((state) => state.drawing?.points ?? [])
  const gridSize = usePlannerStore((state) => state.gridSize)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [typedLength, setTypedLength] = useState('')
  const last = points.at(-1)

  const isClosing = cursor !== null && isClosingPoint(points, cursor, CLOSE_TOLERANCE)
  const preview = !cursor ? null : isClosing ? points[0] : last ? snapDrawPoint(last, cursor, gridSize) : snapFirstPoint(cursor, gridSize)
  const isInvalid = preview !== null && !isClosing && wouldCross(points, preview)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { addDrawPoint, undoDrawPoint, cancelDrawing, finishDrawing, drawing } = usePlannerStore.getState()
      if (/^[0-9.,]$/.test(event.key)) setTypedLength((current) => current + event.key)
      else if (event.key === 'Backspace') typedLength ? setTypedLength(typedLength.slice(0, -1)) : undoDrawPoint()
      else if (event.key === 'Escape') cancelDrawing()
      else if (event.key === 'Enter') {
        const centimetres = Number(typedLength.replace(',', '.'))
        if (typedLength && last && cursor && centimetres > 0) {
          addDrawPoint(pointAtLength(last, snappedDirection(last, cursor), centimetres * MM_PER_CM))
          setTypedLength('')
        } else if (drawing && isValidOutline(drawing.points)) void finishDrawing()
      } else return
      event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [typedLength, last, cursor])

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > CLICK_MAX_DISTANCE_PX || !preview || isInvalid) return
    const { addDrawPoint, finishDrawing } = usePlannerStore.getState()
    setTypedLength('')
    if (isClosing) void finishDrawing()
    else if (!last || preview.x !== last.x || preview.z !== last.z) addDrawPoint(preview)
  }

  const previewLength = last && preview ? Math.hypot(preview.x - last.x, preview.z - last.z) : 0

  return (
    <>
      <mesh
        position-y={-0.02}
        rotation-x={-Math.PI / 2}
        onPointerMove={(event) => setCursor(rayToFloor(event.ray))}
        onClick={handleClick}
      >
        <planeGeometry args={[CATCHER_SIZE, CATCHER_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {points.slice(1).map((point, index) => (
        <FloorLine key={index} from={points[index]} to={point} color={WALL_COLOR} width={WALL_WIDTH} />
      ))}
      {points.map((point, index) => (
        <Corner key={index} point={point} color={index === 0 && isClosing ? PREVIEW_COLOR : WALL_COLOR} radius={index === 0 ? 0.11 : 0.07} />
      ))}

      {last && preview && <FloorLine from={last} to={preview} color={isInvalid ? INVALID_COLOR : PREVIEW_COLOR} width={WALL_WIDTH} />}
      {preview && <Corner point={preview} color={isInvalid ? INVALID_COLOR : PREVIEW_COLOR} />}

      {last && preview && previewLength > 0 && (
        <Html
          center
          position={[mmToM((last.x + preview.x) / 2), 0.05, mmToM((last.z + preview.z) / 2)]}
          zIndexRange={[30, 20]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="whitespace-nowrap rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm">
            {typedLength ? `${typedLength} cm ↵` : isClosing ? 'Fermer la pièce' : formatCm(previewLength)}
          </span>
        </Html>
      )}
    </>
  )
}
