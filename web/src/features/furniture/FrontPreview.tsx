import { useMemo } from 'react'
import { Color } from 'three'
import { computeLayout, type PartKind } from '../../engine/layout'
import type { ParametricFurniture } from '../../engine/schema'

const DRAW_ORDER: PartKind[] = ['back', 'liner', 'carcass', 'plinth', 'separator', 'shelf', 'rail', 'door', 'glass', 'flap', 'drawer', 'sliding', 'handle']
const METAL_COLOR = '#78716c'
const GLASS_COLOR = 'rgba(190, 220, 230, 0.55)'
const BACK_DARKEN = 0.25

type Props = {
  furniture: ParametricFurniture
  /** Colour of the material; the furniture's own carcass colour wins over it. */
  color: string
  maxSize: number
}

const darken = (color: string, amount: number): string => `#${new Color(color).multiplyScalar(1 - amount).getHexString()}`

/** Front elevation of a parametric piece of furniture, at its real proportions. */
export const FrontPreview = ({ furniture, color, maxSize }: Props) => {
  const parts = useMemo(
    () => computeLayout(furniture).parts.toSorted((a, b) => DRAW_ORDER.indexOf(a.kind) - DRAW_ORDER.indexOf(b.kind)),
    [furniture],
  )
  const baseColor = furniture.color ?? color
  const scale = maxSize / Math.max(furniture.width, furniture.height)
  const stroke = Math.max(furniture.width, furniture.height) / 150

  const fillOf = (kind: PartKind, partColor: string | undefined): string => {
    if (kind === 'handle' || kind === 'rail') return METAL_COLOR
    if (kind === 'glass') return GLASS_COLOR
    if (kind === 'back') return darken(baseColor, BACK_DARKEN)
    return partColor ?? baseColor
  }

  return (
    <svg
      width={furniture.width * scale}
      height={furniture.height * scale}
      viewBox={`0 0 ${furniture.width} ${furniture.height}`}
      className="drop-shadow-sm"
      aria-hidden
    >
      {parts.map((part) => (
        <rect
          key={part.key}
          x={part.box.x}
          y={furniture.height - part.box.y - part.box.h}
          width={part.box.w}
          height={part.box.h}
          fill={fillOf(part.kind, part.color)}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={part.kind === 'handle' || part.kind === 'rail' ? 0 : stroke}
        />
      ))}
    </svg>
  )
}
