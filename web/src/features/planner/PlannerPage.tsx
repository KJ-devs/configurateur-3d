import { Check, CloudOff, LayoutGrid, Loader2, Maximize, PanelLeft, Sofa } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useActiveRoom, usePlannerStore, type SaveStatus, type ViewMode } from '../../store/plannerStore'
import { CatalogPanel } from '../catalog/CatalogPanel'
import { RoomSidebar } from './RoomSidebar'
import { RoomWizard } from './RoomWizard'
import { PlannerCanvas } from './scene/PlannerCanvas'

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: '2d', label: '2D' },
  { mode: '3d', label: '3D' },
]

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: 'Enregistré',
  saving: 'Enregistrement…',
  error: 'Échec de la sauvegarde',
}

const SaveIndicator = () => {
  const saveStatus = usePlannerStore((state) => state.saveStatus)
  const icons = { saved: <Check size={14} />, saving: <Loader2 size={14} className="animate-spin" />, error: <CloudOff size={14} /> }

  return (
    <span
      role="status"
      className={`flex items-center gap-1.5 text-xs ${saveStatus === 'error' ? 'text-red-600' : 'text-stone-500'}`}
    >
      {icons[saveStatus]}
      {SAVE_LABELS[saveStatus]}
    </span>
  )
}

const ViewToggle = () => {
  const viewMode = usePlannerStore((state) => state.viewMode)
  const setViewMode = usePlannerStore((state) => state.setViewMode)

  return (
    <div role="group" aria-label="Vue" className="flex rounded-lg bg-stone-100 p-0.5">
      {VIEW_MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={viewMode === mode}
          onClick={() => setViewMode(mode)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            viewMode === mode ? 'bg-white text-accent shadow-sm' : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const panelClass = (isOpen: boolean, side: 'left' | 'right'): string =>
  `${isOpen ? 'flex' : 'hidden'} absolute inset-y-0 z-20 w-72 flex-col bg-white shadow-xl lg:static lg:flex lg:shadow-none ${
    side === 'left' ? 'left-0 border-r lg:w-60' : 'right-0 border-l lg:w-80'
  } border-stone-200`

const toolbarButtonClass =
  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900'

export const PlannerPage = () => {
  const status = usePlannerStore((state) => state.status)
  const projectName = usePlannerStore((state) => state.project?.name)
  const init = usePlannerStore((state) => state.init)
  const requestFrame = usePlannerStore((state) => state.requestFrame)
  const room = useActiveRoom()
  const [openPanel, setOpenPanel] = useState<'rooms' | 'catalog' | null>(null)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') {
    return <p className="flex h-full items-center justify-center text-sm text-stone-500">Chargement du projet…</p>
  }
  if (status === 'error') {
    return (
      <p role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-red-700">
        Impossible de charger le projet. Vérifiez que l'API est démarrée sur le port 5080, puis rechargez la page.
      </p>
    )
  }

  const togglePanel = (panel: 'rooms' | 'catalog') => setOpenPanel(openPanel === panel ? null : panel)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-3 py-2">
        <button type="button" className={`${toolbarButtonClass} lg:hidden`} aria-label="Pièces" onClick={() => togglePanel('rooms')}>
          <PanelLeft size={18} />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <LayoutGrid size={18} className="shrink-0 text-accent" />
          <h1 className="truncate text-sm font-semibold">{projectName}</h1>
        </div>
        <SaveIndicator />

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className={toolbarButtonClass} onClick={requestFrame} title="Cadrer la pièce">
            <Maximize size={16} />
            <span className="hidden sm:inline">Cadrer</span>
          </button>
          <ViewToggle />
          <button type="button" className={`${toolbarButtonClass} lg:hidden`} aria-label="Catalogue" onClick={() => togglePanel('catalog')}>
            <Sofa size={18} />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside className={panelClass(openPanel === 'rooms', 'left')}>
          <RoomSidebar />
        </aside>

        <main className="relative min-w-0 flex-1">
          {room ? (
            <PlannerCanvas room={room} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-stone-500">
              <p>Ce projet n'a pas encore de pièce.</p>
              <button
                type="button"
                onClick={() => setIsWizardOpen(true)}
                className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:brightness-110"
              >
                Créer une pièce
              </button>
            </div>
          )}
        </main>

        <aside className={panelClass(openPanel === 'catalog', 'right')}>
          <CatalogPanel />
        </aside>
      </div>

      {isWizardOpen && <RoomWizard onClose={() => setIsWizardOpen(false)} />}
    </div>
  )
}
