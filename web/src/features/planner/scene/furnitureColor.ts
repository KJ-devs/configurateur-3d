import type { FurnitureInstanceDto, FurnitureModelDto, MaterialDto } from '../../../api/generated/model'

const DEFAULT_FURNITURE_COLOR = '#b8b2a7'

export const furnitureColor = (
  model: FurnitureModelDto,
  materials: Record<string, MaterialDto>,
  instance?: FurnitureInstanceDto,
): string =>
  instance?.colorOverride ?? (model.materialId ? materials[model.materialId]?.colorHex : undefined) ?? DEFAULT_FURNITURE_COLOR
