import type { FurnitureInstanceDto, FurnitureModelDto } from '../api/generated/model'
import { parseFurniture, type ParametricFurniture } from './schema'

export type Dimensions = { width: number; height: number; depth: number }

/** The parametric description of a placed item: its own customised copy, else the catalog model's. */
export const definitionOf = (model: FurnitureModelDto | undefined, instance?: FurnitureInstanceDto): ParametricFurniture | null => {
  if (!model || model.type !== 'Parametric') return null
  return parseFurniture(instance?.parametricOverride ?? model.parametricDefinition)
}

/** Outer dimensions of a placed item, taking its customisation into account. */
export const dimensionsOf = (model: FurnitureModelDto | undefined, instance?: FurnitureInstanceDto): Dimensions | undefined => {
  if (!model) return undefined
  const definition = instance?.parametricOverride ? definitionOf(model, instance) : null
  return definition ?? model
}
