import type { ParametricFurniture } from './schema'

export type Range = { min: number; max: number }

/** Outer dimension limits, in millimetres. */
export const DIMENSION_LIMITS = {
  width: { min: 300, max: 3000 },
  height: { min: 300, max: 2600 },
  depth: { min: 250, max: 800 },
  plinthHeight: { min: 0, max: 200 },
} satisfies Record<string, Range>

export const MIN_COMPARTMENT = 100
export const MAX_SHELVES = 10
export const MAX_DRAWERS = 6
export const BACK_THICKNESS = 8
export const DEFAULT_PANEL_THICKNESS = 18

export const clamp = (value: number, { min, max }: Range): number => Math.min(Math.max(value, min), max)

export const createDefaultFurniture = (materialId: string, panelThickness = DEFAULT_PANEL_THICKNESS): ParametricFurniture => ({
  schemaVersion: 1,
  width: 800,
  height: 1800,
  depth: 400,
  panelThickness,
  materialId,
  hasBack: true,
  plinthHeight: 80,
  root: { id: crypto.randomUUID(), type: 'leaf', content: { kind: 'shelf', count: 3 } },
})
