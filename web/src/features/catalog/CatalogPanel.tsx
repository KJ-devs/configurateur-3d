import { useState } from 'react'
import { CatalogCard } from './CatalogCard'
import { useCatalog } from './useCatalog'

const chipClass = (active: boolean): string =>
  `rounded-full px-3 py-1 text-sm transition ${
    active ? 'bg-accent text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-accent'
  }`

export const CatalogPanel = () => {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const { models, categories, materials, status } = useCatalog({ search, category })

  return (
    <section className="flex flex-col gap-4">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Rechercher un meuble…"
        aria-label="Rechercher un meuble"
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className={chipClass(category === null)} onClick={() => setCategory(null)}>
          Tout
        </button>
        {categories.map((name) => (
          <button key={name} type="button" className={chipClass(category === name)} onClick={() => setCategory(name)}>
            {name}
          </button>
        ))}
      </div>

      {status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Impossible de charger le catalogue. Vérifiez que l'API est démarrée.
        </p>
      )}
      {status === 'loading' && <p className="text-sm text-stone-500">Chargement du catalogue…</p>}
      {status === 'ready' && models.length === 0 && (
        <p className="text-sm text-stone-500">Aucun meuble ne correspond à cette recherche.</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
        {models.map((model) => (
          <CatalogCard key={model.id} model={model} material={materials.find((item) => item.id === model.materialId)} />
        ))}
      </div>
    </section>
  )
}
