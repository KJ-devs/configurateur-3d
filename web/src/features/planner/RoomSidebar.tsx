import { AppWindow, Copy, DoorOpen, Eye, EyeOff, FolderPlus, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { OpeningKind, RoomDto } from '../../api/generated/model'
import { polygonArea } from '../../planner/geometry'
import { rectangleSize } from '../../planner/roomEditing'
import { usePlannerStore } from '../../store/plannerStore'
import { CmInput } from '../builder/fields'
import { RoomWizard } from './RoomWizard'

const MM2_PER_M2 = 1_000_000
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const emptyDragImage = new Image()
emptyDragImage.src = TRANSPARENT_PIXEL

const MM_PER_M = 1000

const formatMetres = (mm: number): string => (mm / MM_PER_M).toLocaleString('fr-FR', { maximumFractionDigits: 2 })

/** "5 × 4 m · 20 m²" for a rectangle, the area alone for any other shape. */
const formatArea = (room: RoomDto): string => {
  const area = `${(polygonArea(room.floorPolygon) / MM2_PER_M2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} m²`
  const size = rectangleSize(room.floorPolygon)
  return size ? `${formatMetres(size.width)} × ${formatMetres(size.depth)} m · ${area}` : area
}

const iconButtonClass = 'rounded p-1 text-stone-400 hover:bg-white hover:text-stone-700'

type RoomRowProps = { room: RoomDto; isActive: boolean; onDragChange: (roomId: string | null) => void }

/** Type of the data dragged between groups, so drops of catalog items are ignored. */
const ROOM_DRAG_TYPE = 'application/x-configurator-room'

const VisibilityButton = ({ isHidden, label, onToggle }: { isHidden: boolean; label: string; onToggle: () => void }) => (
  <button
    type="button"
    aria-pressed={!isHidden}
    title={isHidden ? `Afficher ${label} sur le plan d'ensemble` : `Masquer ${label} du plan d'ensemble`}
    aria-label={isHidden ? `Afficher ${label}` : `Masquer ${label}`}
    onClick={onToggle}
    className={`${iconButtonClass} ${isHidden ? 'text-stone-500' : ''}`}
  >
    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
  </button>
)

const RoomRow = ({ room, isActive, onDragChange }: RoomRowProps) => {
  const openRoom = usePlannerStore((state) => state.openRoom)
  const setActiveRoom = usePlannerStore((state) => state.setActiveRoom)
  const isOverview = usePlannerStore((state) => state.scope === 'overview')
  const setRoomHidden = usePlannerStore((state) => state.setRoomHidden)
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
      draggable={draftName === null}
      onDragStart={(event) => {
        event.dataTransfer.setData(ROOM_DRAG_TYPE, room.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragChange(room.id)
      }}
      onDragEnd={() => onDragChange(null)}
      title="Glisser sur un groupe pour l'y ranger"
      className={`group flex cursor-grab items-center gap-1 rounded-lg py-1.5 pl-0.5 pr-2 active:cursor-grabbing ${
        isActive ? 'bg-accent-soft ring-1 ring-accent/30' : 'hover:bg-stone-100'
      }`}
    >
      <GripVertical size={14} className="shrink-0 text-stone-300 opacity-0 group-hover:opacity-100" aria-hidden />
      {draftName === null ? (
        <button
          type="button"
          // On the overall plan a click only selects the room, so the plan stays in view.
          onClick={() => (isOverview ? setActiveRoom(room.id) : openRoom(room.id))}
          onDoubleClick={() => setDraftName(room.name)}
          className={`flex min-w-0 flex-1 flex-col text-left ${room.isHidden ? 'opacity-50' : ''}`}
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
      {/* Always visible when hidden, so a hidden room is easy to spot and bring back. */}
      <div className={room.isHidden ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}>
        <VisibilityButton isHidden={room.isHidden} label="la pièce" onToggle={() => setRoomHidden(room.id, !room.isHidden)} />
      </div>
    </li>
  )
}

const SettingRow = ({ label, value, onCommit }: { label: string; value: number; onCommit: (mm: number) => void }) => (
  <div className="flex items-center justify-between gap-2 text-sm text-stone-700">
    {label}
    <CmInput value={value} label={`${label} en centimètres`} onCommit={onCommit} />
  </div>
)

/** Group of the room: pick an existing one or type a new name; empty removes it from its group. */
const GroupField = ({ room, groups }: { room: RoomDto; groups: string[] }) => {
  const setRoomGroup = usePlannerStore((state) => state.setRoomGroup)
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft !== null && draft.trim() !== (room.groupName ?? '')) setRoomGroup(room.id, draft.trim() || null)
    setDraft(null)
  }

  return (
    <label className="flex items-center justify-between gap-2 text-sm text-stone-700">
      Groupe
      <input
        value={draft ?? room.groupName ?? ''}
        list="room-groups"
        placeholder="Ex. Rez-de-chaussée"
        maxLength={100}
        aria-label="Groupe de la pièce"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') setDraft(null)
        }}
        className="w-36 rounded-md border border-stone-200 bg-white px-2 py-1 text-sm outline-none placeholder:text-stone-400 focus:border-accent focus:ring-2 focus:ring-accent-soft"
      />
      <datalist id="room-groups">
        {groups.map((group) => (
          <option key={group} value={group} />
        ))}
      </datalist>
    </label>
  )
}

/** Size and group of the active room: exact values here, or drag the walls on the plan. */
const RoomSettings = ({ room, groups }: { room: RoomDto; groups: string[] }) => {
  const resizeRoom = usePlannerStore((state) => state.resizeRoom)
  const updateRoomSettings = usePlannerStore((state) => state.updateRoomSettings)
  const size = rectangleSize(room.floorPolygon)

  return (
    <div className="flex flex-col gap-2 border-t border-stone-200 pt-3">
      <h2 className="text-sm font-semibold">« {room.name} »</h2>
      <GroupField room={room} groups={groups} />
      {size && (
        <>
          <SettingRow label="Largeur" value={size.width} onCommit={(width) => resizeRoom(width, size.depth)} />
          <SettingRow label="Profondeur" value={size.depth} onCommit={(depth) => resizeRoom(size.width, depth)} />
        </>
      )}
      <SettingRow label="Hauteur sous plafond" value={room.ceilingHeight} onCommit={(ceilingHeight) => updateRoomSettings({ ceilingHeight })} />
      <SettingRow label="Épaisseur des murs" value={room.wallThickness} onCommit={(wallThickness) => updateRoomSettings({ wallThickness })} />
      <p className="text-[11px] leading-snug text-stone-500">
        Sur le plan, glissez les pastilles près des murs pour les déplacer, ou cliquez sur une cote en vue 2D pour saisir une longueur.
      </p>
    </div>
  )
}

type OpeningButtonProps = { kind: OpeningKind; label: string; icon: ReactNode }

const OpeningButton = ({ kind, label, icon }: OpeningButtonProps) => {
  const startOpeningDrag = usePlannerStore((state) => state.startOpeningDrag)
  const endCatalogDrag = usePlannerStore((state) => state.endCatalogDrag)
  const addOpening = usePlannerStore((state) => state.addOpening)

  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer.setData('text/plain', kind)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setDragImage(emptyDragImage, 0, 0)
    startOpeningDrag(kind)
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={endCatalogDrag}
      onClick={() => addOpening(kind)}
      title={`Glisser sur un mur, ou cliquer pour ajouter une ${label.toLowerCase()}`}
      className="flex flex-1 cursor-grab flex-col items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs font-medium text-stone-600 hover:border-accent hover:text-accent active:cursor-grabbing"
    >
      {icon}
      {label}
    </button>
  )
}

type RoomGroup = { name: string | null; rooms: RoomDto[] }

/** Rooms by group, in the order groups first appear; rooms without a group come last. */
const groupRooms = (rooms: RoomDto[]): RoomGroup[] => {
  const groups = new Map<string | null, RoomDto[]>()
  for (const room of rooms) groups.set(room.groupName ?? null, [...(groups.get(room.groupName ?? null) ?? []), room])
  return [...groups.entries()]
    .map(([name, members]) => ({ name, rooms: members }))
    .sort((a, b) => Number(a.name === null) - Number(b.name === null))
}

type GroupHeaderProps = { group: RoomGroup; isRenaming: boolean; onRenamingChange: (isRenaming: boolean) => void }

const GroupHeader = ({ group, isRenaming, onRenamingChange }: GroupHeaderProps) => {
  const setGroupHidden = usePlannerStore((state) => state.setGroupHidden)
  const renameGroup = usePlannerStore((state) => state.renameGroup)
  const [draft, setDraft] = useState(group.name ?? '')
  const isHidden = group.rooms.every((room) => room.isHidden)
  const { name } = group

  const commit = () => {
    if (name !== null) renameGroup(name, draft)
    onRenamingChange(false)
  }

  return (
    <div className="mt-1 flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
      {isRenaming && name !== null ? (
        <input
          autoFocus
          value={draft}
          maxLength={100}
          aria-label="Nom du groupe"
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') onRenamingChange(false)
          }}
          className="min-w-0 flex-1 rounded border border-accent bg-white px-1.5 py-0.5 text-xs font-medium normal-case tracking-normal text-stone-800 outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={name === null}
          onDoubleClick={() => {
            setDraft(name ?? '')
            onRenamingChange(true)
          }}
          title={name === null ? undefined : 'Double-cliquer pour renommer le groupe'}
          className={`min-w-0 flex-1 truncate text-left uppercase ${isHidden ? 'opacity-50' : ''}`}
        >
          {name ?? 'Sans groupe'}
        </button>
      )}
      <span className="font-normal normal-case">{group.rooms.length}</span>
      {name !== null && !isRenaming && (
        <button
          type="button"
          className={iconButtonClass}
          aria-label="Renommer le groupe"
          title="Renommer le groupe"
          onClick={() => {
            setDraft(name)
            onRenamingChange(true)
          }}
        >
          <Pencil size={12} />
        </button>
      )}
      <VisibilityButton isHidden={isHidden} label="le groupe" onToggle={() => setGroupHidden(name, !isHidden)} />
    </div>
  )
}

type DropZoneProps = { isDragging: boolean; onDropRoom: (roomId: string) => void; className?: string; children: ReactNode }

/** Area a dragged room can be dropped on; it lights up while a room hovers it. */
const DropZone = ({ isDragging, onDropRoom, className = '', children }: DropZoneProps) => {
  const [isOver, setIsOver] = useState(false)
  const accepts = (event: DragEvent) => isDragging && event.dataTransfer.types.includes(ROOM_DRAG_TYPE)

  return (
    <div
      onDragOver={(event) => {
        if (!accepts(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setIsOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOver(false)
      }}
      onDrop={(event) => {
        setIsOver(false)
        const roomId = event.dataTransfer.getData(ROOM_DRAG_TYPE)
        if (!accepts(event) || !roomId) return
        event.preventDefault()
        onDropRoom(roomId)
      }}
      className={`rounded-lg transition ${isOver ? 'bg-accent-soft ring-2 ring-accent' : isDragging ? 'outline-1 outline-dashed outline-stone-300' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

const NEW_GROUP_NAME = 'Nouveau groupe'

const uniqueGroupName = (existing: string[]): string => {
  if (!existing.includes(NEW_GROUP_NAME)) return NEW_GROUP_NAME
  let index = 2
  while (existing.includes(`${NEW_GROUP_NAME} ${index}`)) index++
  return `${NEW_GROUP_NAME} ${index}`
}

export const RoomSidebar = () => {
  const rooms = usePlannerStore((state) => state.rooms)
  const activeRoomId = usePlannerStore((state) => state.activeRoomId)
  const setRoomGroup = usePlannerStore((state) => state.setRoomGroup)
  const activeRoom = rooms.find((room) => room.id === activeRoomId)
  const isOverview = usePlannerStore((state) => state.scope === 'overview')
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [draggedRoomId, setDraggedRoomId] = useState<string | null>(null)
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const groups = groupRooms(rooms)
  const hasGroups = groups.some((group) => group.name !== null)
  const hasUngrouped = groups.some((group) => group.name === null)
  const groupNames = groups.flatMap((group) => (group.name === null ? [] : [group.name]))
  const isDragging = draggedRoomId !== null

  const moveToGroup = (roomId: string, groupName: string | null) => {
    setDraggedRoomId(null)
    if ((rooms.find((room) => room.id === roomId)?.groupName ?? null) !== groupName) setRoomGroup(roomId, groupName)
  }

  const createGroupWith = (roomId: string) => {
    const name = uniqueGroupName(groupNames)
    moveToGroup(roomId, name)
    // The new group is named right away: its header opens in edit mode.
    setRenamingGroup(name)
  }

  return (
    <section className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div>
        <h2 className="text-sm font-semibold">Pièces</h2>
        {rooms.length > 1 && <p className="text-[11px] text-stone-500">Glissez une pièce sur un groupe pour l'y ranger.</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        {groups.map((group) => (
          <DropZone
            key={group.name ?? ''}
            isDragging={isDragging}
            onDropRoom={(roomId) => moveToGroup(roomId, group.name)}
            className="flex flex-col gap-1 p-0.5"
          >
            {hasGroups && (
              <GroupHeader
                group={group}
                isRenaming={group.name !== null && renamingGroup === group.name}
                onRenamingChange={(isRenaming) => setRenamingGroup(isRenaming ? group.name : null)}
              />
            )}
            <ul className="flex flex-col gap-1">
              {group.rooms.map((room) => (
                <RoomRow key={room.id} room={room} isActive={room.id === activeRoomId} onDragChange={setDraggedRoomId} />
              ))}
            </ul>
          </DropZone>
        ))}
        {isDragging && hasGroups && !hasUngrouped && (
          <DropZone isDragging onDropRoom={(roomId) => moveToGroup(roomId, null)} className="px-3 py-2 text-xs text-stone-500">
            Sortir du groupe
          </DropZone>
        )}
        {isDragging && (
          <DropZone isDragging onDropRoom={createGroupWith} className="flex items-center gap-2 px-3 py-2 text-xs text-stone-500">
            <FolderPlus size={14} /> Déposer ici pour créer un groupe
          </DropZone>
        )}
      </div>
      <button
        type="button"
        onClick={() => setIsWizardOpen(true)}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:border-accent hover:text-accent"
      >
        <Plus size={16} />
        Nouvelle pièce
      </button>

      {activeRoom && <RoomSettings room={activeRoom} groups={groupNames} />}
      {activeRoomId && !isOverview && (
        <div className="flex flex-col gap-2 border-t border-stone-200 pt-3">
          <h2 className="text-sm font-semibold">Ouvertures</h2>
          <div className="flex gap-2">
            <OpeningButton kind="Door" label="Porte" icon={<DoorOpen size={20} />} />
            <OpeningButton kind="Window" label="Fenêtre" icon={<AppWindow size={20} />} />
          </div>
        </div>
      )}
      {isWizardOpen && <RoomWizard onClose={() => setIsWizardOpen(false)} />}
    </section>
  )
}
