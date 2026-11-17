import { Edges } from '@react-three/drei'
import { useMemo } from 'react'
import { Color } from 'three'
import { computeLayout, FRONT_KINDS, type Part } from '../../engine/layout'
import type { ParametricFurniture } from '../../engine/schema'
import { mmToM } from '../../lib/units'

const METAL_COLOR = '#a8a29e'
const GLASS_COLOR = '#d6e7ec'
const GLASS_OPACITY = 0.35
const EDGE_DARKEN = 0.35
const BACK_DARKEN = 0.12
const HIDDEN_FRONT_OPACITY = 0.12
const ignoreRaycast = () => null

const darken = (color: string, amount: number): string => `#${new Color(color).multiplyScalar(1 - amount).getHexString()}`

type Props = {
  furniture: ParametricFurniture
  /** Base colour, used by every part without a colour of its own. */
  color: string
  /** When false, doors and drawer fronts turn see-through to show the inside. */
  showFronts?: boolean
  emissive?: string
}

type PartMeshProps = { part: Part; baseColor: string; isGhost: boolean; emissive?: string }

const PartMesh = ({ part, baseColor, isGhost, emissive }: PartMeshProps) => {
  const { x, y, z, w, h, d } = part.box
  const position: [number, number, number] = [mmToM(x + w / 2), mmToM(y + h / 2), mmToM(z + d / 2)]
  const isMetal = part.kind === 'handle' || part.kind === 'rail'
  const isGlass = part.kind === 'glass'
  const ownColor = part.color ?? baseColor
  const surfaceColor = isMetal ? METAL_COLOR : isGlass ? GLASS_COLOR : part.kind === 'back' ? darken(ownColor, BACK_DARKEN) : ownColor
  const edgeColor = useMemo(() => darken(isGlass ? ownColor : surfaceColor, EDGE_DARKEN), [isGlass, ownColor, surfaceColor])
  const isTransparent = isGhost || isGlass
  const opacity = isGhost ? HIDDEN_FRONT_OPACITY : isGlass ? GLASS_OPACITY : 1

  const material = (
    <meshStandardMaterial
      // Switching transparency needs a new shader: a new key rebuilds the material.
      key={isTransparent ? 'transparent' : 'solid'}
      color={surfaceColor}
      metalness={isMetal ? 0.6 : 0}
      roughness={isMetal || isGlass ? 0.2 : 0.75}
      transparent={isTransparent}
      opacity={opacity}
      depthWrite={!isTransparent}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissive ? 0.4 : 0}
    />
  )

  if (part.kind === 'rail') {
    return (
      <mesh position={position} rotation-z={Math.PI / 2} raycast={ignoreRaycast}>
        <cylinderGeometry args={[mmToM(h / 2), mmToM(h / 2), mmToM(w), 16]} />
        {material}
      </mesh>
    )
  }

  return (
    <mesh position={position} raycast={ignoreRaycast}>
      <boxGeometry args={[mmToM(w), mmToM(h), mmToM(d)]} />
      {material}
      {!isMetal && !isGhost && part.kind !== 'liner' && <Edges color={edgeColor} />}
    </mesh>
  )
}

/** Panels of a parametric piece of furniture, in its own frame: origin at the bottom, left, back corner. */
export const ParametricMesh = ({ furniture, color, showFronts = true, emissive }: Props) => {
  const layout = useMemo(() => computeLayout(furniture), [furniture])

  return layout.parts.map((part) => (
    <PartMesh key={part.key} part={part} baseColor={color} isGhost={!showFronts && FRONT_KINDS.has(part.kind)} emissive={emissive} />
  ))
}
