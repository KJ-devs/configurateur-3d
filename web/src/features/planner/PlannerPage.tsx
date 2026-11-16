import { useEffect, useState } from 'react'
import { useActiveRoom, usePlannerStore, type ViewMode } from '../../store/plannerStore'
import { CatalogPanel } from '../catalog/CatalogPanel'
import { PlannerHeader } from './PlannerHeader'
import { RoomSidebar } from './RoomSidebar'
import { RoomWizard } from './RoomWizard'
import { PlannerCanvas } from './scene/PlannerCanvas'
import { usePlannerShortcuts } from './usePlannerShortcuts'

type Panel = 'rooms' | 'catalog'

const VIEW_HINTS: Record<ViewMode, string> = {
  '2d': 'Glisser dans le vide : sélection multiple · Clic droit : déplacer la vue · Molette : zoom · Alt : sans aimantation',
  '3d': 'Glisser : tourner la vue · Clic droit : déplacer la vue · Molette : zoom · Maj+clic : sélection multiple',
}

const panelClass = (isOpen: boolean, side: 'left' | 'right'): string =>
  `${isOpen ? 'flex' : 'hidden'} absolute inset-y-0 z-20 w-72 flex-col bg-white shadow-xl lg:static lg:flex lg:shadow-none ${
    side === 'left' ? 'left-0 border-r lg:w-60' : 'right-0 border-l lg:w-80'
  } border-stone-200`

export const PlannerPage = () => {
  const status = usePlannerStore((state) => state.status)
  const viewMode = usePlannerStore((state) => state.viewMode)
  const init = usePlannerStore((state) => state.init)
  const room = useActiveRoom()
  const [openPanel, setOpenPanel] = useState<Panel | null>(null)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  usePlannerShortcuts()

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

  return (
    <div className="flex h-full flex-col">
      <PlannerHeader onTogglePanel={(panel) => setOpenPanel(openPanel === panel ? null : panel)} />

      <div className="relative flex min-h-0 flex-1">
        <aside className={panelClass(openPanel === 'rooms', 'left')}>
          <RoomSidebar />
        </aside>

        <main className="relative min-w-0 flex-1" onContextMenu={(event) => event.preventDefault()}>
          {room ? (
            <>
              <PlannerCanvas room={room} />
              <p className="pointer-events-none absolute bottom-2 left-1/2 hidden w-max max-w-full -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-[11px] text-stone-500 md:block">
                {VIEW_HINTS[viewMode]}
              </p>
            </>
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
