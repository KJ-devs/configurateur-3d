import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Raycaster, Vector2 } from 'three'
import type { RoomDto } from '../../../api/generated/model'
import { clampToBounds, footprintHalfExtents, polygonBounds } from '../../../planner/geometry'
import { usePlannerStore } from '../../../store/plannerStore'
import { rayToFloor } from './floorPlane'

type Props = { room: RoomDto }

/** Turns HTML drag events coming from the catalog and the openings palette into ghost positions. */
export const CatalogDropHandler = ({ room }: Props) => {
  const canvas = useThree((state) => state.gl.domElement)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const bounds = polygonBounds(room.floorPolygon)

    const handleDragOver = (event: DragEvent) => {
      const { ghost, models, moveGhost } = usePlannerStore.getState()
      if (!ghost) return
      event.preventDefault()

      const rect = canvas.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const floorPoint = rayToFloor(raycaster.ray)
      if (!floorPoint) return

      const model = ghost.kind === 'model' ? models[ghost.modelId] : undefined
      if (!model) return moveGhost(floorPoint)
      const { halfX, halfZ } = footprintHalfExtents(model.width, model.depth, 0)
      moveGhost(clampToBounds(floorPoint, halfX, halfZ, bounds))
    }
    const handleDragLeave = () => usePlannerStore.getState().moveGhost(null)
    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      usePlannerStore.getState().dropGhost()
    }

    canvas.addEventListener('dragover', handleDragOver)
    canvas.addEventListener('dragleave', handleDragLeave)
    canvas.addEventListener('drop', handleDrop)
    return () => {
      canvas.removeEventListener('dragover', handleDragOver)
      canvas.removeEventListener('dragleave', handleDragLeave)
      canvas.removeEventListener('drop', handleDrop)
    }
  }, [canvas, camera, room.floorPolygon])

  return null
}
