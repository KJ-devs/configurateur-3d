import { mmToM } from '../../../lib/units'
import { usePlannerStore } from '../../../store/plannerStore'
import { furnitureColor } from './furnitureColor'

const GHOST_OPACITY = 0.55
const ignoreRaycast = () => null

/** Translucent preview following the cursor while a catalog item is dragged over the scene. */
export const GhostFurniture = () => {
  const ghost = usePlannerStore((state) => state.ghost)
  const model = usePlannerStore((state) => (state.ghost ? state.models[state.ghost.modelId] : undefined))
  const materials = usePlannerStore((state) => state.materials)

  if (!ghost?.position || !model) return null

  const height = mmToM(model.height)
  return (
    <mesh position={[mmToM(ghost.position.x), height / 2, mmToM(ghost.position.z)]} raycast={ignoreRaycast}>
      <boxGeometry args={[mmToM(model.width), height, mmToM(model.depth)]} />
      <meshStandardMaterial color={furnitureColor(model, materials)} transparent opacity={GHOST_OPACITY} depthWrite={false} />
    </mesh>
  )
}
