import { resolveApiUrl } from '../../api/http'
import type { FurnitureModelDto, MaterialDto } from '../../api/generated/model'
import { formatDimensions, formatPrice } from '../../lib/units'

const SILHOUETTE_BOX = 72
const DEFAULT_COLOR = '#b8b2a7'

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

export const CatalogCard = ({ model, material }: Props) => (
  <article className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:border-accent hover:shadow-md">
    <div className="flex h-28 items-end justify-center bg-stone-100 pb-3">
      {model.thumbnailUrl ? (
        <img src={resolveApiUrl(model.thumbnailUrl)} alt="" className="h-full w-full object-contain" />
      ) : (
        <Silhouette model={model} color={material?.colorHex ?? DEFAULT_COLOR} />
      )}
    </div>
    <div className="flex flex-1 flex-col gap-1 p-3">
      <h3 className="text-sm font-medium leading-tight">{model.name}</h3>
      <p className="text-xs text-stone-500">{formatDimensions(model.width, model.height, model.depth)}</p>
      <div className="mt-auto flex items-center justify-between pt-2 text-xs">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
          {model.type === 'Parametric' ? 'Sur mesure' : 'Standard'}
        </span>
        {model.basePrice != null && <span className="font-medium">{formatPrice(model.basePrice)}</span>}
      </div>
    </div>
  </article>
)
