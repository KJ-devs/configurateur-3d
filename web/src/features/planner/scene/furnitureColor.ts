import type { FurnitureInstanceDto, FurnitureModelDto, MaterialDto } from '../../../api/generated/model'
import type { ParametricFurniture } from '../../../engine/schema'

const DEFAULT_FURNITURE_COLOR = '#b8b2a7'

export const furnitureColor = (
  model: FurnitureModelDto,
  materials: Record<string, MaterialDto>,
  instance?: FurnitureInstanceDto,
  definition?: ParametricFurniture | null,
): string => {
  const materialId = definition?.materialId ?? model.materialId
  return (
    instance?.colorOverride ??
    definition?.color ??
    (materialId ? materials[materialId]?.colorHex : undefined) ??
    DEFAULT_FURNITURE_COLOR
  )
}
