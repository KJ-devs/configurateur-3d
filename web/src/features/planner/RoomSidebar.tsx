import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import type { RoomDto } from '../../api/generated/model'
import { polygonArea } from '../../planner/geometry'
import { usePlannerStore } from '../../store/plannerStore'
import { RoomWizard } from './RoomWizard'

const MM2_PER_M2 = 1_000_000

const formatArea = (room: RoomDto): string =>
  `${(polygonArea(room.floorPolygon) / MM2_PER_M2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} m²`

const iconButtonClass = 'rounded p-1 text-stone-400 hover:bg-white hover:text-stone-700'

type RoomRowProps = { room: RoomDto; isActive: boolean }

const RoomRow = ({ room, isActive }: RoomRowProps) => {
  const setActiveRoom = usePlannerStore((state) => state.setActiveRoom)
  const renameRoom = usePlannerStore((state) => state.renameRoom)
  const duplicateRoom = usePlannerStore((state) => state.duplicateRoom)
  const deleteRoom = usePlannerStore((state) => state.deleteRoom)
  const [draftName, setDraftName] = useState<string | null>(null)

  const commitRename = () => {
    const name = draftName?.trim()
    if (name) void renameRoom(room.id, name)
    setDraftName(null)
  }

  const handleRenameKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') commitRename()
    if (event.key === 'Escape') setDraftName(null)
  }

  const handleDelete = () => {
    if (window.confirm(`Supprimer la pièce « ${room.name} » et ses meubles ?`)) void deleteRoom(room.id)
  }

  return (
    <li
      className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 ${
        isActive ? 'bg-accent-soft ring-1 ring-accent/30' : 'hover:bg-stone-100'
      }`}
    >
      {draftName === null ? (
        <button
          type="button"
          onClick={() => setActiveRoom(room.id)}
          onDoubleClick={() => setDraftName(room.name)}
          className="flex min-w-0 flex-1 flex-col text-left"
        >
          <span className={`truncate text-sm ${isActive ? 'font-semibold text-accent' : 'font-medium'}`}>{room.name}</span>
          <span className="text-xs text-stone-500">{formatArea(room)}</span>
        </button>
      ) : (
        <input
          autoFocus
          value={draftName}
          maxLength={200}
          aria-label="Nom de la pièce"
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKey}
          className="min-w-0 flex-1 rounded border border-accent bg-white px-2 py-1 text-sm outline-none"
        />
      )}

      <div className={`flex ${isActive ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
        <button type="button" title="Renommer" aria-label="Renommer" className={iconButtonClass} onClick={() => setDraftName(room.name)}>
          <Pencil size={14} />
        </button>
        <button type="button" title="Dupliquer" aria-label="Dupliquer" className={iconButtonClass} onClick={() => void duplicateRoom(room.id)}>
          <Copy size={14} />
        </button>
        <button type="button" title="Supprimer" aria-label="Supprimer" className={`${iconButtonClass} hover:text-red-600`} onClick={handleDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  )
}

export const RoomSidebar = () => {
  const rooms = usePlannerStore((state) => state.rooms)
  const activeRoomId = usePlannerStore((state) => state.activeRoomId)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  return (
    <section className="flex h-full flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold">Pièces</h2>
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {rooms.map((room) => (
          <RoomRow key={room.id} room={room} isActive={room.id === activeRoomId} />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setIsWizardOpen(true)}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:border-accent hover:text-accent"
      >
        <Plus size={16} />
        Nouvelle pièce
      </button>
      {isWizardOpen && <RoomWizard onClose={() => setIsWizardOpen(false)} />}
    </section>
  )
}
