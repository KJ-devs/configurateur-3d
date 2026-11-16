import { Check, CloudOff, LayoutGrid, Loader2, Maximize, PanelLeft, Redo2, Sofa, Undo2 } from 'lucide-react'
import { useHistoryStore } from '../../store/history'
import { usePlannerStore, type SaveStatus, type ViewMode } from '../../store/plannerStore'

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: '2d', label: '2D' },
  { mode: '3d', label: '3D' },
]

const GRID_OPTIONS = [
  { value: 0, label: 'Sans grille' },
  { value: 10, label: 'Grille 1 cm' },
  { value: 50, label: 'Grille 5 cm' },
  { value: 100, label: 'Grille 10 cm' },
]

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: 'Enregistré',
  saving: 'Enregistrement…',
  error: 'Échec de la sauvegarde',
}

const toolbarButtonClass =
  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-35'

const SaveIndicator = () => {
  const saveStatus = usePlannerStore((state) => state.saveStatus)
  const icons = { saved: <Check size={14} />, saving: <Loader2 size={14} className="animate-spin" />, error: <CloudOff size={14} /> }

  return (
    <span role="status" className={`flex items-center gap-1.5 text-xs ${saveStatus === 'error' ? 'text-red-600' : 'text-stone-500'}`}>
      {icons[saveStatus]}
      <span className="hidden sm:inline">{SAVE_LABELS[saveStatus]}</span>
    </span>
  )
}

const HistoryButtons = () => {
  const undoLabel = useHistoryStore((state) => state.past.at(-1)?.label)
  const redoLabel = useHistoryStore((state) => state.future[0]?.label)
  const undo = useHistoryStore((state) => state.undo)
  const redo = useHistoryStore((state) => state.redo)

  return (
    <div className="flex">
      <button
        type="button"
        className={toolbarButtonClass}
        disabled={!undoLabel}
        onClick={undo}
        aria-label="Annuler"
        title={undoLabel ? `Annuler : ${undoLabel} (Ctrl+Z)` : 'Rien à annuler'}
      >
        <Undo2 size={16} />
      </button>
      <button
        type="button"
        className={toolbarButtonClass}
        disabled={!redoLabel}
        onClick={redo}
        aria-label="Rétablir"
        title={redoLabel ? `Rétablir : ${redoLabel} (Ctrl+Y)` : 'Rien à rétablir'}
      >
        <Redo2 size={16} />
      </button>
    </div>
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

type Props = { onTogglePanel: (panel: 'rooms' | 'catalog') => void }

export const PlannerHeader = ({ onTogglePanel }: Props) => {
  const projectName = usePlannerStore((state) => state.project?.name)
  const gridSize = usePlannerStore((state) => state.gridSize)
  const setGridSize = usePlannerStore((state) => state.setGridSize)
  const requestFrame = usePlannerStore((state) => state.requestFrame)

  return (
    <header className="flex items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
      <button type="button" className={`${toolbarButtonClass} lg:hidden`} aria-label="Pièces" onClick={() => onTogglePanel('rooms')}>
        <PanelLeft size={18} />
      </button>
      <div className="flex min-w-0 items-center gap-2">
        <LayoutGrid size={18} className="shrink-0 text-accent" />
        <h1 className="truncate text-sm font-semibold">{projectName}</h1>
      </div>
      <SaveIndicator />
      <HistoryButtons />

      <div className="ml-auto flex items-center gap-2">
        <select
          value={gridSize}
          onChange={(event) => setGridSize(Number(event.target.value))}
          aria-label="Pas de la grille d'aimantation"
          className="hidden rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-600 outline-none focus:border-accent md:block"
        >
          {GRID_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className={toolbarButtonClass} onClick={requestFrame} title="Cadrer la pièce">
          <Maximize size={16} />
          <span className="hidden sm:inline">Cadrer</span>
        </button>
        <ViewToggle />
        <button type="button" className={`${toolbarButtonClass} lg:hidden`} aria-label="Catalogue" onClick={() => onTogglePanel('catalog')}>
          <Sofa size={18} />
        </button>
      </div>
    </header>
  )
}
