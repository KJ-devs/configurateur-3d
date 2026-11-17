import type { Box, Cell, Layout, PartKind } from './layout'
import { MIN_COMPARTMENT } from './limits'
import type { ParametricFurniture } from './schema'

const MM2_PER_M2 = 1_000_000
const BACK_PRICE_RATIO = 0.35
const CUSTOM_COLOR_SURCHARGE = 1.2
const GLASS_PRICE_PER_M2 = 90
const HARDWARE_PRICES: Partial<Record<PartKind, number>> = { door: 14, glass: 14, flap: 25, drawer: 32, sliding: 45, rail: 15, handle: 6 }
const PANEL_KINDS = new Set<PartKind>(['carcass', 'separator', 'shelf', 'door', 'flap', 'drawer', 'sliding', 'plinth'])
const THIN_KINDS = new Set<PartKind>(['back', 'liner'])

const MAX_SINGLE_DOOR_WIDTH = 600
const MIN_DRAWER_HEIGHT = 90
const MIN_SHELF_SPACING = 80
const MIN_RAIL_DEPTH = 500
const MIN_RAIL_HEIGHT = 800

/** Area of the largest face of a panel, in m². */
const faceArea = (box: Box): number => {
  const [, middle, largest] = [box.w, box.h, box.d].sort((a, b) => a - b)
  return (middle * largest) / MM2_PER_M2
}

export type Estimate = { panelArea: number; price: number }

/**
 * Panels at the material's price per m² (thin backs at a fraction of it, custom colours with a surcharge),
 * glass at its own price, plus hardware.
 */
export const estimatePrice = (layout: Layout, pricePerM2: number, isBaseColorCustom = false): Estimate => {
  let panelArea = 0
  let price = 0
  for (const part of layout.parts) {
    const area = faceArea(part.box)
    const panelPrice = pricePerM2 * (part.color || isBaseColorCustom ? CUSTOM_COLOR_SURCHARGE : 1)
    if (PANEL_KINDS.has(part.kind)) {
      panelArea += area
      price += area * panelPrice
    } else if (THIN_KINDS.has(part.kind)) {
      price += area * panelPrice * BACK_PRICE_RATIO
    } else if (part.kind === 'glass') {
      price += area * GLASS_PRICE_PER_M2
    }
    price += HARDWARE_PRICES[part.kind] ?? 0
  }
  return { panelArea, price: Math.round(price) }
}

export type Issue = { cellId: string; message: string }

const cellIssues = (cell: Cell, furniture: ParametricFurniture): string[] => {
  const { w, h } = cell.rect
  const { content } = cell
  if (w < MIN_COMPARTMENT || h < MIN_COMPARTMENT) return ['Compartiment trop petit (moins de 10 cm)']

  const isHinged = content.kind === 'door' || content.kind === 'glassDoor' || content.kind === 'doubleDoor' || content.kind === 'flap'
  if (furniture.slidingDoors && isHinged) return ['Cette façade est bloquée par les portes coulissantes']

  switch (content.kind) {
    case 'door':
    case 'glassDoor':
      return w > MAX_SINGLE_DOOR_WIDTH ? ['Porte de plus de 60 cm : une double porte serait plus pratique'] : []
    case 'drawer':
      return h / content.count < MIN_DRAWER_HEIGHT ? ['Tiroirs trop bas : réduisez leur nombre'] : []
    case 'shelf': {
      const spacing = (h - content.count * furniture.panelThickness) / (content.count + 1)
      return spacing < MIN_SHELF_SPACING ? ['Étagères trop rapprochées (moins de 8 cm)'] : []
    }
    case 'rail':
      return [
        ...(furniture.depth < MIN_RAIL_DEPTH ? ['Penderie : 50 cm de profondeur conseillés pour les cintres'] : []),
        ...(h < MIN_RAIL_HEIGHT ? ['Penderie : moins de 80 cm de hauteur'] : []),
      ]
    default:
      return []
  }
}

/** Advice about compartments that would be impractical once built. It never blocks saving. */
export const findIssues = (furniture: ParametricFurniture, layout: Layout): Issue[] =>
  layout.cells.flatMap((cell) => cellIssues(cell, furniture).map((message) => ({ cellId: cell.id, message })))
