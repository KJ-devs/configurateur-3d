import { Eye, EyeOff, Maximize } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useBuilderStore } from '../../store/builderStore'
import { BuilderHeader } from './BuilderHeader'
import { CellPanel } from './CellPanel'
import { FurniturePanel } from './FurniturePanel'
import { BuilderCanvas } from './scene/BuilderCanvas'

const overlayButtonClass =
  'flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 text-sm text-stone-600 shadow-sm ring-1 ring-stone-200 hover:text-stone-900'

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const useBuilderShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      const builder = useBuilderStore.getState()
      const key = event.key.toLowerCase()
      const isCommand = event.ctrlKey || event.metaKey

      if (isCommand && key === 'z' && !event.shiftKey) builder.undo()
      else if (isCommand && (key === 'y' || (key === 'z' && event.shiftKey))) builder.redo()
      else if (!isCommand && event.key === 'Escape') builder.selectCell(null)
      else return
      event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

/** Full-screen editor of a parametric piece of furniture. */
export const BuilderPage = () => {
  const showFronts = useBuilderStore((state) => state.showFronts)
  const toggleFronts = useBuilderStore((state) => state.toggleFronts)
  const error = useBuilderStore((state) => state.error)
  const [frameKey, setFrameKey] = useState(0)
  useBuilderShortcuts()

  return (
    <div className="flex h-full flex-col">
      <BuilderHeader />
      {error && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="order-2 border-stone-200 bg-white lg:order-none lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-r">
          <FurniturePanel />
        </aside>

        <main className="relative h-[55vh] shrink-0 lg:h-auto lg:min-w-0 lg:flex-1" onContextMenu={(event) => event.preventDefault()}>
          <BuilderCanvas frameKey={frameKey} />
          <div className="absolute left-3 top-3 flex gap-2">
            <button type="button" className={overlayButtonClass} onClick={() => setFrameKey(frameKey + 1)} title="Recadrer la vue">
              <Maximize size={16} />
              <span className="hidden sm:inline">Recadrer</span>
            </button>
            <button type="button" className={overlayButtonClass} aria-pressed={!showFronts} onClick={toggleFronts}>
              {showFronts ? <EyeOff size={16} /> : <Eye size={16} />}
              {showFronts ? "Voir l'intérieur" : 'Afficher les façades'}
            </button>
          </div>
          <p className="pointer-events-none absolute bottom-2 left-1/2 hidden w-max max-w-full -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-[11px] text-stone-500 md:block">
            Clic : choisir un compartiment · Glisser une séparation : la déplacer · Glisser ailleurs : tourner · Clic droit : déplacer la vue
          </p>
        </main>

        <aside className="order-3 border-stone-200 bg-white lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-l">
          <CellPanel />
        </aside>
      </div>
    </div>
  )
}
