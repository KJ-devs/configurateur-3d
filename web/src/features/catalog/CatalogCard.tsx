import { PencilRuler } from 'lucide-react'
import type { DragEvent } from 'react'
import type { FurnitureModelDto, MaterialDto } from '../../api/generated/model'
import { resolveApiUrl } from '../../api/http'
import { definitionOf } from '../../engine/furniture'
import { formatDimensions, formatPrice } from '../../lib/units'
import { useBuilderStore } from '../../store/builderStore'
import { usePlannerStore } from '../../store/plannerStore'
import { FrontPreview } from '../furniture/FrontPreview'

const SILHOUETTE_BOX = 56
const DEFAULT_COLOR = '#b8b2a7'
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const emptyDragImage = new Image()
emptyDragImage.src = TRANSPARENT_PIXEL

type Props = { model: FurnitureModelDto; material: MaterialDto | undefined }

/** Front-view silhouette at the furniture's real proportions, shown until a thumbnail exists. */
const Silhouette = ({ model, color }: { model: FurnitureModelDto; color: string }) => {
  const scale = SILHOUETTE_BOX / Math.max(model.width, model.height)
  return (
    <div
      className="rounded-sm shadow-sm ring-1 ring-black/10"
      style={{ width: model.width * scale, height: model.height * scale, backgroundColor: color }}
    />
  )
}

export const CatalogCard = ({ model, material }: Props) => {
  const startCatalogDrag = usePlannerStore((state) => state.startCatalogDrag)
  const endCatalogDrag = usePlannerStore((state) => state.endCatalogDrag)
  const addInstanceAtCenter = usePlannerStore((state) => state.addInstanceAtCenter)
  const openBuilder = useBuilderStore((state) => state.open)
  const definition = definitionOf(model)
  const color = material?.colorHex ?? DEFAULT_COLOR

  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer.setData('text/plain', model.id)
    event.dataTransfer.effectAllowed = 'copy'
    // The 3D ghost in the scene is the preview: hide the browser's own drag image.
    event.dataTransfer.setDragImage(emptyDragImage, 0, 0)
    startCatalogDrag(model.id)
  }

  return (
    <div className="group relative flex">
      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={endCatalogDrag}
        onClick={() => addInstanceAtCenter(model.id)}
        title={`Ajouter « ${model.name} » à la pièce`}
        className="flex w-full cursor-grab flex-col overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition hover:border-accent hover:shadow-md active:cursor-grabbing"
      >
        <div className="flex h-20 w-full items-end justify-center bg-stone-100 pb-2">
          {model.thumbnailUrl ? (
            <img src={resolveApiUrl(model.thumbnailUrl)} alt="" draggable={false} className="h-full w-full object-contain" />
          ) : definition ? (
            <FrontPreview furniture={definition} color={color} maxSize={SILHOUETTE_BOX} />
          ) : (
            <Silhouette model={model} color={color} />
          )}
        </div>
        <div className="flex w-full flex-1 flex-col gap-0.5 p-2">
          <h3 className="text-xs font-medium leading-tight">{model.name}</h3>
          <p className="text-[11px] text-stone-500">{formatDimensions(model.width, model.height, model.depth)}</p>
          <div className="mt-auto flex items-center justify-between pt-1 text-[11px]">
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-accent">
              {model.type === 'Parametric' ? 'Sur mesure' : 'Standard'}
            </span>
            {model.basePrice != null && <span className="font-medium">{formatPrice(model.basePrice)}</span>}
          </div>
        </div>
      </button>
      {definition && (
        <button
          type="button"
          onClick={() => openBuilder({ kind: 'model', modelId: model.id })}
          title={`Modifier « ${model.name} »`}
          aria-label={`Modifier « ${model.name} »`}
          className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-stone-500 opacity-0 shadow-sm ring-1 ring-stone-200 transition hover:text-accent focus:opacity-100 group-hover:opacity-100"
        >
          <PencilRuler size={14} />
        </button>
      )}
    </div>
  )
}
