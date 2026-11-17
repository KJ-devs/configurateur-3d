import { ArrowLeft, Loader2, Redo2, Undo2 } from 'lucide-react'
import { useMemo } from 'react'
import { useBuilderStore, type SaveMode } from '../../store/builderStore'
import { usePlannerStore } from '../../store/plannerStore'

const iconButtonClass =
  'rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-35'
const primaryClass = 'flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50'
const secondaryClass = 'rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50'
const fieldClass =
  'min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 outline-none hover:border-stone-200 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent-soft'

type Action = { mode: SaveMode; label: string }

const useSaveActions = (): { primary: Action; secondary?: Action } => {
  const source = useBuilderStore((state) => state.source)
  const hasRoom = usePlannerStore((state) => state.activeRoomId !== null)

  if (source?.kind === 'instance') {
    return { primary: { mode: 'apply', label: 'Appliquer au meuble' }, secondary: { mode: 'create', label: 'Ajouter aussi au catalogue' } }
  }
  if (source?.kind === 'model') {
    return { primary: { mode: 'update', label: 'Enregistrer' }, secondary: { mode: 'create', label: 'Enregistrer comme nouveau' } }
  }
  return { primary: { mode: 'create', label: hasRoom ? 'Créer et placer dans la pièce' : 'Ajouter au catalogue' } }
}

export const BuilderHeader = () => {
  const name = useBuilderStore((state) => state.name)
  const category = useBuilderStore((state) => state.category)
  const canUndo = useBuilderStore((state) => state.past.length > 0)
  const canRedo = useBuilderStore((state) => state.future.length > 0)
  const isSaving = useBuilderStore((state) => state.isSaving)
  const { setName, setCategory, undo, redo, close, save } = useBuilderStore.getState()
  const models = usePlannerStore((state) => state.models)
  const categories = useMemo(() => [...new Set(Object.values(models).map((model) => model.category))].sort(), [models])
  const { primary, secondary } = useSaveActions()

  const handleClose = () => {
    if (!canUndo || window.confirm('Quitter sans enregistrer ? Les modifications seront perdues.')) close()
  }

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
      <button type="button" onClick={handleClose} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-stone-600 hover:bg-stone-100">
        <ArrowLeft size={16} />
        <span className="hidden sm:inline">Retour au plan</span>
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-1">
        <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Nom du meuble" maxLength={200} className={`${fieldClass} w-56 text-sm font-semibold`} />
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          list="builder-categories"
          aria-label="Catégorie"
          maxLength={100}
          className={`${fieldClass} hidden w-36 text-sm text-stone-500 md:block`}
        />
        <datalist id="builder-categories">
          {categories.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>

      <div className="flex">
        <button type="button" className={iconButtonClass} disabled={!canUndo} onClick={undo} aria-label="Annuler" title="Annuler (Ctrl+Z)">
          <Undo2 size={16} />
        </button>
        <button type="button" className={iconButtonClass} disabled={!canRedo} onClick={redo} aria-label="Rétablir" title="Rétablir (Ctrl+Y)">
          <Redo2 size={16} />
        </button>
      </div>

      {secondary && (
        <button type="button" className={secondaryClass} disabled={isSaving} onClick={() => void save(secondary.mode)}>
          {secondary.label}
        </button>
      )}
      <button type="button" className={primaryClass} disabled={isSaving} onClick={() => void save(primary.mode)}>
        {isSaving && <Loader2 size={14} className="animate-spin" />}
        {primary.label}
      </button>
    </header>
  )
}
