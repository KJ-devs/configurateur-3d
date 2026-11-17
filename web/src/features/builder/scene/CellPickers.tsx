import { Edges, Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useState } from 'react'
import type { Cell, Layout } from '../../../engine/layout'
import type { ParametricFurniture } from '../../../engine/schema'
import { formatCm, mmToM } from '../../../lib/units'
import { useBuilderStore } from '../../../store/builderStore'

const ACCENT = '#2f6f5e'
const WARNING = '#d97706'
const CLICK_MAX_DISTANCE_PX = 4
/** Pickers stand a little proud of the front so they win over the carcass edges. */
const FRONT_MARGIN = 4

type Props = { furniture: ParametricFurniture; layout: Layout; warningIds: Set<string> }

const CellPicker = ({ cell, furniture, backZ, isWarning }: { cell: Cell; furniture: ParametricFurniture; backZ: number; isWarning: boolean }) => {
  const isSelected = useBuilderStore((state) => state.selectedCellId === cell.id)
  const [isHovered, setIsHovered] = useState(false)
  const { x, y, w, h } = cell.rect
  const depth = furniture.depth - backZ + FRONT_MARGIN
  const color = isWarning && !isSelected ? WARNING : ACCENT
  const opacity = isSelected ? 0.22 : isHovered ? 0.12 : isWarning ? 0.1 : 0

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (event.delta <= CLICK_MAX_DISTANCE_PX) useBuilderStore.getState().selectCell(cell.id)
  }

  return (
    <group position={[mmToM(x + w / 2), mmToM(y + h / 2), mmToM(backZ + depth / 2)]}>
      <mesh
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation()
          setIsHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setIsHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <boxGeometry args={[mmToM(w), mmToM(h), mmToM(depth)]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        {(isSelected || isHovered) && <Edges color={color} lineWidth={isSelected ? 2.5 : 1.5} />}
      </mesh>
      {isSelected && (
        <Html center position={[0, 0, mmToM(depth / 2)]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white shadow">
            {formatCm(w)} × {formatCm(h)}
          </span>
        </Html>
      )}
    </group>
  )
}

/** Invisible volumes over the compartments: hover to highlight, click to select. */
export const CellPickers = ({ furniture, layout, warningIds }: Props) =>
  layout.cells.map((cell) => (
    <CellPicker key={cell.id} cell={cell} furniture={furniture} backZ={layout.backZ} isWarning={warningIds.has(cell.id)} />
  ))
