import { useMemo, useState } from 'react'
import { usePlannerStore } from '../../store/plannerStore'
import { CatalogCard } from './CatalogCard'

const chipClass = (active: boolean): string =>
  `rounded-full px-2.5 py-1 text-xs transition ${
    active ? 'bg-accent text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-accent'
  }`

export const CatalogPanel = () => {
  const modelsById = usePlannerStore((state) => state.models)
  const materials = usePlannerStore((state) => state.materials)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const models = useMemo(
    () => Object.values(modelsById).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [modelsById],
  )
  const categories = useMemo(() => [...new Set(models.map((model) => model.category))].sort(), [models])
  const visibleModels = models.filter(
    (model) =>
      (category === null || model.category === category) &&
      model.name.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')),
  )

  return (
    <section className="flex h-full flex-col gap-3 p-4">
      <div>
        <h2 className="text-sm font-semibold">Catalogue</h2>
        <p className="text-xs text-stone-500">Glissez un meuble dans la pièce, ou cliquez pour l'ajouter.</p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Rechercher un meuble…"
        aria-label="Rechercher un meuble"
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={chipClass(category === null)} onClick={() => setCategory(null)}>
          Tout
        </button>
        {categories.map((name) => (
          <button key={name} type="button" className={chipClass(category === name)} onClick={() => setCategory(name)}>
            {name}
          </button>
        ))}
      </div>

      {visibleModels.length === 0 && <p className="text-sm text-stone-500">Aucun meuble ne correspond à cette recherche.</p>}

      <div className="-mr-2 grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pr-2">
        {visibleModels.map((model) => (
          <CatalogCard key={model.id} model={model} material={model.materialId ? materials[model.materialId] : undefined} />
        ))}
      </div>
    </section>
  )
}
