import { create } from 'zustand'
import {
  createRoom as createRoomRequest,
  deleteRoom as deleteRoomRequest,
  duplicateRoom as duplicateRoomRequest,
  getFurnitureModels,
  getMaterials,
  syncInstances,
  syncOpenings,
  updateRoom,
} from '../api/generated/api'
import type {
  FurnitureInstanceDto,
  FurnitureModelDto,
  HingeSide,
  MaterialDto,
  OpeningDto,
  OpeningKind,
  ProjectDto,
  RoomDto,
} from '../api/generated/model'
import { dimensionsOf } from '../engine/furniture'
import type { ParametricFurniture } from '../engine/schema'
import {
  dragItems,
  duplicateItems,
  freePositionFor,
  nudgeItems,
  placeItem,
  rotateItems,
  rotateItemTo,
  type EditContext,
} from '../planner/editing'
import { boundsCenter, computeWalls, polygonBounds, rectanglePolygon, type Point } from '../planner/geometry'
import { findOpeningSpot, openingCenter, placeOpening, type OpeningPlacement } from '../planner/openings'
import {
  fitItems,
  fitOpenings,
  MIN_WALL_LENGTH,
  moveWall,
  rectangleSize,
  resizeRectangle,
  setWallLength,
  type WallMove,
} from '../planner/roomEditing'
import type { Guide } from '../planner/snapping'
import { nextRoomPosition, snapRoomPosition, spreadStackedRooms } from '../planner/plan'
import { isValidOutline, normalizeOutline } from '../planner/wallDrawing'
import { useHistoryStore } from './history'
import { DEFAULT_WALL_THICKNESS, loadOrCreateProject, toRoomRequest } from './projectLoader'

const AUTOSAVE_DELAY_MS = 800
const DEFAULT_GRID_SIZE = 50
const OPENING_DROP_MAX_DISTANCE = 1200

const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; sillHeight: number }> = {
  Door: { width: 830, height: 2040, sillHeight: 0 },
  Window: { width: 1200, height: 1250, sillHeight: 900 },
}

export type ViewMode = '2d' | '3d'
/** One room to furnish, or every visible room on the overall plan. */
export type Scope = 'room' | 'overview'
export type SaveStatus = 'saved' | 'saving' | 'error'
export type NewRoomInput = { name: string; width: number; depth: number; ceilingHeight: number }
export type Drawing = { name: string; ceilingHeight: number; points: Point[] }
export type Ghost =
  | { kind: 'model'; modelId: string; position: Point | null }
  | { kind: 'opening'; openingKind: OpeningKind; placement: OpeningPlacement | null }

type RoomContent = { instances: FurnitureInstanceDto[]; openings: OpeningDto[] }
type RoomShape = RoomContent & Pick<RoomDto, 'floorPolygon' | 'ceilingHeight' | 'wallThickness'>
type WallDragSession = { before: RoomDto; wallIndex: number }
type RoomLayout = Pick<RoomDto, 'positionX' | 'positionZ' | 'groupName' | 'isHidden'>
type DragSession = { roomId: string; snapshot: RoomContent; label: string }
type InstancesUpdate = (instances: FurnitureInstanceDto[], context: EditContext<FurnitureInstanceDto>) => FurnitureInstanceDto[]
type OpeningsUpdate = (openings: OpeningDto[], room: RoomDto) => OpeningDto[]

type PlannerState = {
  status: 'loading' | 'ready' | 'error'
  project: ProjectDto | null
  rooms: RoomDto[]
  activeRoomId: string | null
  models: Record<string, FurnitureModelDto>
  materials: Record<string, MaterialDto>
  selectedIds: string[]
  selectedOpeningId: string | null
  viewMode: ViewMode
  scope: Scope
  gridSize: number
  ghost: Ghost | null
  guides: Guide[]
  drawing: Drawing | null
  isDragging: boolean
  frameRequest: number
  saveStatus: SaveStatus

  init: () => Promise<void>
  createRoom: (input: NewRoomInput) => Promise<void>
  renameRoom: (roomId: string, name: string) => Promise<void>
  duplicateRoom: (roomId: string) => Promise<void>
  deleteRoom: (roomId: string) => Promise<void>
  setActiveRoom: (roomId: string) => void
  setViewMode: (viewMode: ViewMode) => void
  setScope: (scope: Scope) => void
  /** Makes a room active and shows it alone, ready to furnish. */
  openRoom: (roomId: string) => void
  beginRoomMove: (roomId: string) => void
  /** Moves the room by `delta` mm on the overall plan from where it was when the move began. */
  dragRoomBy: (delta: Point) => void
  endRoomMove: () => void
  setRoomGroup: (roomId: string, groupName: string | null) => void
  setRoomHidden: (roomId: string, isHidden: boolean) => void
  /** Shows or hides every room of a group (null: the rooms without a group). */
  setGroupHidden: (groupName: string | null, isHidden: boolean) => void
  renameGroup: (groupName: string, newName: string) => void
  setGridSize: (gridSize: number) => void
  requestFrame: () => void

  startDrawing: (name: string, ceilingHeight: number) => void
  addDrawPoint: (point: Point) => void
  undoDrawPoint: () => void
  cancelDrawing: () => void
  finishDrawing: () => Promise<void>

  select: (instanceId: string, isAdditive?: boolean) => void
  setSelection: (instanceIds: string[]) => void
  selectOpening: (openingId: string) => void
  clearSelection: () => void

  startCatalogDrag: (modelId: string) => void
  startOpeningDrag: (openingKind: OpeningKind) => void
  moveGhost: (point: Point | null) => void
  dropGhost: () => void
  endCatalogDrag: () => void
  addInstanceAtCenter: (modelId: string) => void
  addOpening: (openingKind: OpeningKind) => void

  /** A drag previews changes live and becomes a single undo step when it ends. */
  beginDrag: (label: string) => void
  dragSelectionBy: (delta: Point, isSnapEnabled: boolean) => void
  dragRotationTo: (instanceId: string, degrees: number) => void
  dragOpeningTo: (openingId: string, point: Point) => void
  endDrag: () => void

  rotateSelected: (deltaDegrees: number) => void
  nudgeSelected: (delta: Point) => void
  duplicateSelected: () => void
  deleteSelected: () => void
  setSelectedColor: (color: string | null) => void
  placeInstance: (instanceId: string, position: Point) => void
  updateSelectedOpening: (patch: Partial<Pick<OpeningDto, 'width' | 'hingeSide'>>) => void

  /** Wall being dragged, for the live dimensions. */
  draggedWall: number | null
  beginWallDrag: (wallIndex: number) => void
  /** Moves the dragged wall by `distance` mm along its outward normal, from where it was when the drag began. */
  dragWallBy: (distance: number) => void
  endWallDrag: () => void
  setWallLength: (wallIndex: number, length: number) => void
  resizeRoom: (width: number, depth: number) => void
  updateRoomSettings: (patch: Partial<Pick<RoomDto, 'ceilingHeight' | 'wallThickness'>>) => void

  /** Adds or replaces a catalog model after it was saved from the furniture builder. */
  upsertModel: (model: FurnitureModelDto) => void
  /** Gives a placed item its own parametric description, or brings back the catalog one with null. */
  customiseInstance: (instanceId: string, definition: ParametricFurniture | null) => void
}

const indexById = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

const contentOf = (room: RoomDto): RoomContent => ({ instances: room.instances, openings: room.openings })

const shapeOf = (room: RoomDto): RoomShape => ({
  ...contentOf(room),
  floorPolygon: room.floorPolygon,
  ceilingHeight: room.ceilingHeight,
  wallThickness: room.wallThickness,
})

const ROOM_LIMITS = { ceilingHeight: { min: 1800, max: 6000 }, wallThickness: { min: 50, max: 500 } }
const MIN_WALL_STEP = 10

const clampTo = (value: number, { min, max }: { min: number; max: number }): number => Math.round(Math.min(Math.max(value, min), max))

const hasChanged = (before: RoomContent, after: RoomContent): boolean =>
  before.instances !== after.instances || before.openings !== after.openings

export const usePlannerStore = create<PlannerState>((set, get) => {
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /** Rooms whose outline, height or walls changed since the last save. */
  const geometryChanged = new Set<string>()
  let hasInitStarted = false
  let dragSession: DragSession | null = null
  let wallDrag: WallDragSession | null = null

  const findRoom = (roomId: string | null): RoomDto | undefined => get().rooms.find((room) => room.id === roomId)

  const saveRoomContent = async (roomId: string) => {
    saveTimers.delete(roomId)
    const room = findRoom(roomId)
    if (!room) return

    try {
      // The outline first: the server checks openings against the walls it knows.
      if (geometryChanged.delete(roomId)) await updateRoom(roomId, toRoomRequest(room))
      await Promise.all([
        syncInstances(roomId, { instances: room.instances }),
        syncOpenings(roomId, { openings: room.openings }),
      ])
      if (saveTimers.size === 0) set({ saveStatus: 'saved' })
    } catch {
      set({ saveStatus: 'error' })
    }
  }

  const scheduleSave = (roomId: string) => {
    clearTimeout(saveTimers.get(roomId))
    saveTimers.set(roomId, setTimeout(() => void saveRoomContent(roomId), AUTOSAVE_DELAY_MS))
    set({ saveStatus: 'saving' })
  }

  const editContext = (room: RoomDto): EditContext<FurnitureInstanceDto> => ({
    sizeOf: (instance) => dimensionsOf(get().models[instance.furnitureModelId], instance),
    polygon: room.floorPolygon,
    wallThickness: room.wallThickness,
    gridSize: get().gridSize,
  })

  const patchRoom = (roomId: string, content: RoomContent) =>
    get().rooms.map((room) => (room.id === roomId ? { ...room, ...content } : room))

  /** Replaces the content of a room without touching the history. */
  const setRoomContent = (roomId: string, content: RoomContent) => {
    const isActive = get().activeRoomId === roomId
    const instanceIds = new Set(content.instances.map((instance) => instance.id))
    const { selectedIds, selectedOpeningId } = get()
    const isOpeningKept = content.openings.some((opening) => opening.id === selectedOpeningId)
    set({
      rooms: patchRoom(roomId, content),
      selectedIds: isActive ? selectedIds.filter((id) => instanceIds.has(id)) : selectedIds,
      selectedOpeningId: isActive && !isOpeningKept ? null : selectedOpeningId,
    })
    scheduleSave(roomId)
  }

  const recordChange = (label: string, roomId: string, before: RoomContent, after: RoomContent) =>
    useHistoryStore.getState().record({
      label,
      undo: () => setRoomContent(roomId, before),
      redo: () => setRoomContent(roomId, after),
    })

  /** Applies an edit to the active room as one undo step. */
  const applyChange = (label: string, update: (content: RoomContent, room: RoomDto) => RoomContent) => {
    const room = findRoom(get().activeRoomId)
    if (!room) return

    const before = contentOf(room)
    const after = update(before, room)
    if (!hasChanged(before, after)) return
    setRoomContent(room.id, after)
    recordChange(label, room.id, before, after)
  }

  /** Replaces the outline, walls and content of a room without touching the history. */
  const setRoomShape = (roomId: string, { instances, openings, ...geometry }: RoomShape) => {
    set({ rooms: get().rooms.map((room) => (room.id === roomId ? { ...room, ...geometry } : room)) })
    geometryChanged.add(roomId)
    setRoomContent(roomId, { instances, openings })
  }

  const recordShapeChange = (label: string, roomId: string, before: RoomShape, after: RoomShape) =>
    useHistoryStore.getState().record({
      label,
      undo: () => setRoomShape(roomId, before),
      redo: () => setRoomShape(roomId, after),
    })

  /** The room with a new outline: openings stay in their walls, furniture follows the moved wall and stays inside. */
  const reshape = (room: RoomDto, polygon: Point[], move: WallMove | null): RoomShape => ({
    ...shapeOf(room),
    floorPolygon: polygon,
    openings: fitOpenings(room.openings, polygon),
    instances: fitItems(room.instances, room.floorPolygon, move, { ...editContext(room), polygon }),
  })

  const applyShapeChange = (label: string, update: (room: RoomDto) => RoomShape | null) => {
    const room = findRoom(get().activeRoomId)
    const after = room && update(room)
    if (!room || !after) return
    const before = shapeOf(room)
    setRoomShape(room.id, after)
    recordShapeChange(label, room.id, before, after)
  }

  const applyInstancesChange = (label: string, update: InstancesUpdate) =>
    applyChange(label, (content, room) => ({ ...content, instances: update(content.instances, editContext(room)) }))

  const applyOpeningsChange = (label: string, update: OpeningsUpdate) =>
    applyChange(label, (content, room) => ({ ...content, openings: update(content.openings, room) }))

  const previewDrag = (update: (snapshot: RoomContent, room: RoomDto) => RoomContent, guides: Guide[] = []) => {
    const room = dragSession && findRoom(dragSession.roomId)
    if (!dragSession || !room) return
    set({ rooms: patchRoom(room.id, update(dragSession.snapshot, room)), guides })
  }

  const addInstance = (modelId: string, position: Point) => {
    const room = findRoom(get().activeRoomId)
    if (!room || !get().models[modelId]) return

    const instance: FurnitureInstanceDto = {
      id: crypto.randomUUID(),
      roomId: room.id,
      furnitureModelId: modelId,
      x: Math.round(position.x),
      z: Math.round(position.z),
      rotationY: 0,
    }
    applyInstancesChange('Ajouter un meuble', (instances, context) => {
      const free = freePositionFor(instance, instances, context)
      return [...instances, { ...instance, x: Math.round(free.x), z: Math.round(free.z) }]
    })
    set({ selectedIds: [instance.id], selectedOpeningId: null })
  }

  const insertOpening = (openingKind: OpeningKind, placement: OpeningPlacement) => {
    const room = findRoom(get().activeRoomId)
    if (!room) return

    const hingeSide: HingeSide = 'Left'
    const opening: OpeningDto = { id: crypto.randomUUID(), roomId: room.id, kind: openingKind, hingeSide, ...OPENING_DEFAULTS[openingKind], ...placement }
    applyOpeningsChange(openingKind === 'Door' ? 'Ajouter une porte' : 'Ajouter une fenêtre', (openings) => [...openings, opening])
    set({ selectedIds: [], selectedOpeningId: opening.id })
  }

  const wallsOf = (room: RoomDto) => computeWalls(room.floorPolygon, room.wallThickness)

  /** A created room opens to be furnished; a copy stays where the user is (on the overall plan for instance). */
  const addRoom = (room: RoomDto, isOpened = true) =>
    set({
      rooms: [...get().rooms, room],
      activeRoomId: room.id,
      scope: isOpened ? 'room' : get().scope,
      selectedIds: [],
      selectedOpeningId: null,
    })

  /** A new room goes beside the others on the overall plan, in the group of the room being worked on. */
  const newRoomLayout = (): RoomLayout => {
    const groupName = findRoom(get().activeRoomId)?.groupName ?? null
    const position = nextRoomPosition(get().rooms.filter((room) => (room.groupName ?? null) === groupName))
    return { positionX: position.x, positionZ: position.z, groupName, isHidden: false }
  }

  /** Saves where a room sits, its group or its visibility, without touching the history. */
  const setRoomLayout = (roomId: string, patch: Partial<RoomLayout>) => {
    set({ rooms: get().rooms.map((room) => (room.id === roomId ? { ...room, ...patch } : room)) })
    geometryChanged.add(roomId)
    scheduleSave(roomId)
  }

  let roomMove: RoomDto | null = null

  return {
    status: 'loading',
    project: null,
    rooms: [],
    activeRoomId: null,
    models: {},
    materials: {},
    selectedIds: [],
    selectedOpeningId: null,
    viewMode: '3d',
    scope: 'room',
    gridSize: DEFAULT_GRID_SIZE,
    ghost: null,
    guides: [],
    drawing: null,
    isDragging: false,
    frameRequest: 0,
    saveStatus: 'saved',

    init: async () => {
      if (hasInitStarted) return
      hasInitStarted = true

      try {
        const [{ project, rooms }, models, materials] = await Promise.all([
          loadOrCreateProject(),
          getFurnitureModels(),
          getMaterials(),
        ])
        set({
          status: 'ready',
          project,
          rooms,
          activeRoomId: rooms[0]?.id ?? null,
          models: indexById(models),
          materials: indexById(materials),
        })
        for (const room of spreadStackedRooms(rooms)) setRoomLayout(room.id, { positionX: room.positionX, positionZ: room.positionZ })
      } catch {
        set({ status: 'error' })
      }
    },

    createRoom: async ({ name, width, depth, ceilingHeight }) => {
      const { project, rooms } = get()
      if (!project) return

      addRoom(
        await createRoomRequest(project.id, {
          name,
          floorPolygon: rectanglePolygon(width, depth),
          ceilingHeight,
          wallThickness: DEFAULT_WALL_THICKNESS,
          sortOrder: rooms.length,
          ...newRoomLayout(),
        }),
      )
    },

    renameRoom: async (roomId, name) => {
      const room = findRoom(roomId)
      if (!room || room.name === name) return

      set({ rooms: get().rooms.map((candidate) => (candidate.id === roomId ? { ...candidate, name } : candidate)) })
      await updateRoom(roomId, toRoomRequest(room, { name }))
    },

    duplicateRoom: async (roomId) => addRoom(await duplicateRoomRequest(roomId), false),

    deleteRoom: async (roomId) => {
      await deleteRoomRequest(roomId)
      const rooms = get().rooms.filter((room) => room.id !== roomId)
      const activeRoomId = get().activeRoomId === roomId ? (rooms[0]?.id ?? null) : get().activeRoomId
      set({ rooms, activeRoomId, selectedIds: [], selectedOpeningId: null })
    },

    setActiveRoom: (roomId) => set({ activeRoomId: roomId, selectedIds: [], selectedOpeningId: null, drawing: null }),
    setViewMode: (viewMode) => set({ viewMode }),
    setScope: (scope) => set({ scope, selectedIds: [], selectedOpeningId: null }),
    openRoom: (roomId) => set({ activeRoomId: roomId, scope: 'room', selectedIds: [], selectedOpeningId: null, drawing: null }),

    beginRoomMove: (roomId) => {
      roomMove = findRoom(roomId) ?? null
      if (roomMove) set({ isDragging: true })
    },
    dragRoomBy: (delta) => {
      const start = roomMove
      if (!start) return
      const others = get().rooms.filter((room) => !room.isHidden && room.id !== start.id)
      const target = { x: start.positionX + delta.x, z: start.positionZ + delta.z }
      const { x, z } = snapRoomPosition(start, target, others)
      set({ rooms: get().rooms.map((room) => (room.id === start.id ? { ...room, positionX: x, positionZ: z } : room)) })
    },
    endRoomMove: () => {
      const start = roomMove
      roomMove = null
      set({ isDragging: false })
      const room = start && findRoom(start.id)
      if (!start || !room || (room.positionX === start.positionX && room.positionZ === start.positionZ)) return

      const before = { positionX: start.positionX, positionZ: start.positionZ }
      const after = { positionX: room.positionX, positionZ: room.positionZ }
      setRoomLayout(room.id, after)
      useHistoryStore.getState().record({
        label: 'Déplacer une pièce',
        undo: () => setRoomLayout(room.id, before),
        redo: () => setRoomLayout(room.id, after),
      })
    },
    setRoomGroup: (roomId, groupName) => setRoomLayout(roomId, { groupName: groupName?.trim() || null }),
    setRoomHidden: (roomId, isHidden) => setRoomLayout(roomId, { isHidden }),
    setGroupHidden: (groupName, isHidden) =>
      get()
        .rooms.filter((room) => (room.groupName ?? null) === groupName && room.isHidden !== isHidden)
        .forEach((room) => setRoomLayout(room.id, { isHidden })),
    renameGroup: (groupName, newName) => {
      const name = newName.trim()
      if (!name || name === groupName) return
      get()
        .rooms.filter((room) => room.groupName === groupName)
        .forEach((room) => setRoomLayout(room.id, { groupName: name }))
    },
    setGridSize: (gridSize) => set({ gridSize }),
    requestFrame: () => set({ frameRequest: get().frameRequest + 1 }),

    startDrawing: (name, ceilingHeight) =>
      set({ drawing: { name, ceilingHeight, points: [] }, viewMode: '2d', selectedIds: [], selectedOpeningId: null }),
    addDrawPoint: (point) => {
      const { drawing } = get()
      if (drawing) set({ drawing: { ...drawing, points: [...drawing.points, point] } })
    },
    undoDrawPoint: () => {
      const { drawing } = get()
      if (drawing) set({ drawing: { ...drawing, points: drawing.points.slice(0, -1) } })
    },
    cancelDrawing: () => set({ drawing: null }),
    finishDrawing: async () => {
      const { drawing, project, rooms } = get()
      if (!drawing || !project || !isValidOutline(drawing.points)) return

      set({ drawing: null })
      addRoom(
        await createRoomRequest(project.id, {
          name: drawing.name,
          floorPolygon: normalizeOutline(drawing.points),
          ceilingHeight: drawing.ceilingHeight,
          wallThickness: DEFAULT_WALL_THICKNESS,
          sortOrder: rooms.length,
          ...newRoomLayout(),
        }),
      )
    },

    select: (instanceId, isAdditive = false) => {
      const { selectedIds } = get()
      if (!isAdditive) return set({ selectedIds: [instanceId], selectedOpeningId: null })
      set({
        selectedOpeningId: null,
        selectedIds: selectedIds.includes(instanceId)
          ? selectedIds.filter((id) => id !== instanceId)
          : [...selectedIds, instanceId],
      })
    },
    setSelection: (instanceIds) => set({ selectedIds: instanceIds, selectedOpeningId: null }),
    selectOpening: (openingId) => set({ selectedIds: [], selectedOpeningId: openingId }),
    clearSelection: () => {
      if (get().selectedIds.length > 0 || get().selectedOpeningId) set({ selectedIds: [], selectedOpeningId: null })
    },

    startCatalogDrag: (modelId) => set({ ghost: { kind: 'model', modelId, position: null } }),
    startOpeningDrag: (openingKind) => set({ ghost: { kind: 'opening', openingKind, placement: null } }),
    moveGhost: (point) => {
      const { ghost } = get()
      const room = findRoom(get().activeRoomId)
      if (!ghost || !room) return
      if (ghost.kind === 'model') return set({ ghost: { ...ghost, position: point } })

      const width = OPENING_DEFAULTS[ghost.openingKind].width
      const placement = point && placeOpening(point, width, wallsOf(room), room.openings, OPENING_DROP_MAX_DISTANCE)
      set({ ghost: { ...ghost, placement } })
    },
    dropGhost: () => {
      const { ghost } = get()
      if (ghost?.kind === 'model' && ghost.position) addInstance(ghost.modelId, ghost.position)
      if (ghost?.kind === 'opening' && ghost.placement) insertOpening(ghost.openingKind, ghost.placement)
      set({ ghost: null })
    },
    endCatalogDrag: () => set({ ghost: null }),
    addInstanceAtCenter: (modelId) => {
      const room = findRoom(get().activeRoomId)
      // Furniture is added to the room being furnished: from the overall plan, open it first.
      if (get().scope === 'overview') set({ scope: 'room' })
      if (room) addInstance(modelId, boundsCenter(polygonBounds(room.floorPolygon)))
    },
    addOpening: (openingKind) => {
      const room = findRoom(get().activeRoomId)
      const placement = room && findOpeningSpot(OPENING_DEFAULTS[openingKind].width, wallsOf(room), room.openings)
      if (placement) insertOpening(openingKind, placement)
    },

    beginDrag: (label) => {
      const room = findRoom(get().activeRoomId)
      if (!room) return
      dragSession = { roomId: room.id, snapshot: contentOf(room), label }
      set({ isDragging: true })
    },
    dragSelectionBy: (delta, isSnapEnabled) => {
      const room = dragSession && findRoom(dragSession.roomId)
      if (!dragSession || !room) return

      const { items, guides } = dragItems(dragSession.snapshot.instances, get().selectedIds, delta, editContext(room), isSnapEnabled)
      previewDrag((snapshot) => ({ ...snapshot, instances: items }), guides)
    },
    dragRotationTo: (instanceId, degrees) =>
      previewDrag((snapshot, room) => ({
        ...snapshot,
        instances: rotateItemTo(snapshot.instances, instanceId, degrees, editContext(room)),
      })),
    dragOpeningTo: (openingId, point) => {
      const room = dragSession && findRoom(dragSession.roomId)
      const opening = dragSession?.snapshot.openings.find((candidate) => candidate.id === openingId)
      if (!dragSession || !room || !opening) return

      const others = dragSession.snapshot.openings.filter((candidate) => candidate.id !== openingId)
      const placement = placeOpening(point, opening.width, wallsOf(room), others)
      if (!placement) return
      previewDrag((snapshot) => ({
        ...snapshot,
        openings: snapshot.openings.map((candidate) => (candidate.id === openingId ? { ...candidate, ...placement } : candidate)),
      }))
    },
    endDrag: () => {
      const session = dragSession
      dragSession = null
      set({ isDragging: false, guides: [] })
      const room = session && findRoom(session.roomId)
      if (!session || !room || !hasChanged(session.snapshot, contentOf(room))) return

      scheduleSave(room.id)
      recordChange(session.label, room.id, session.snapshot, contentOf(room))
    },

    rotateSelected: (deltaDegrees) => {
      if (get().selectedIds.length === 0) return
      applyInstancesChange('Tourner', (instances, context) => rotateItems(instances, get().selectedIds, deltaDegrees, context))
    },
    nudgeSelected: (delta) => {
      if (get().selectedIds.length === 0) return
      applyInstancesChange('Déplacer', (instances, context) => nudgeItems(instances, get().selectedIds, delta, context))
    },
    duplicateSelected: () => {
      let createdIds: string[] = []
      applyInstancesChange('Dupliquer', (instances, context) => {
        const { items, newIds } = duplicateItems(instances, get().selectedIds, context, () => crypto.randomUUID())
        createdIds = newIds
        return newIds.length > 0 ? items : instances
      })
      if (createdIds.length > 0) set({ selectedIds: createdIds })
    },
    deleteSelected: () => {
      const { selectedIds, selectedOpeningId } = get()
      if (selectedOpeningId) {
        return applyOpeningsChange('Supprimer', (openings) => openings.filter((opening) => opening.id !== selectedOpeningId))
      }
      if (selectedIds.length === 0) return
      applyInstancesChange('Supprimer', (instances) => instances.filter((instance) => !selectedIds.includes(instance.id)))
    },
    setSelectedColor: (color) => {
      const { selectedIds } = get()
      if (selectedIds.length === 0) return
      applyInstancesChange('Changer la couleur', (instances) =>
        instances.map((instance) => (selectedIds.includes(instance.id) ? { ...instance, colorOverride: color } : instance)),
      )
    },
    placeInstance: (instanceId, position) =>
      applyInstancesChange('Placer', (instances, context) => placeItem(instances, instanceId, position, context)),
    updateSelectedOpening: (patch) => {
      const { selectedOpeningId } = get()
      applyOpeningsChange('Modifier l’ouverture', (openings, room) => {
        const current = openings.find((opening) => opening.id === selectedOpeningId)
        if (!current) return openings

        const updated = { ...current, ...patch }
        const others = openings.filter((opening) => opening.id !== current.id)
        const wall = wallsOf(room)[current.wallIndex]
        const placement = placeOpening(openingCenter(current, wall), updated.width, [wall], others)
        return placement ? openings.map((opening) => (opening.id === current.id ? { ...updated, ...placement } : opening)) : openings
      })
    },

    draggedWall: null,
    beginWallDrag: (wallIndex) => {
      const room = findRoom(get().activeRoomId)
      if (!room) return
      wallDrag = { before: room, wallIndex }
      set({ draggedWall: wallIndex, isDragging: true })
    },
    dragWallBy: (distance) => {
      if (!wallDrag) return
      const { before, wallIndex } = wallDrag
      const step = get().gridSize || MIN_WALL_STEP
      const move = moveWall(before.floorPolygon, wallIndex, Math.round(distance / step) * step)
      const shape = reshape(before, move.polygon, move)
      set({ rooms: get().rooms.map((room) => (room.id === before.id ? { ...room, ...shape } : room)) })
    },
    endWallDrag: () => {
      const session = wallDrag
      wallDrag = null
      set({ draggedWall: null, isDragging: false })
      const room = session && findRoom(session.before.id)
      if (!session || !room || room.floorPolygon === session.before.floorPolygon) return

      geometryChanged.add(room.id)
      scheduleSave(room.id)
      recordShapeChange('Déplacer un mur', room.id, shapeOf(session.before), shapeOf(room))
    },
    setWallLength: (wallIndex, length) =>
      applyShapeChange('Modifier la longueur du mur', (room) => {
        const move = setWallLength(room.floorPolygon, wallIndex, Math.round(length))
        return move && reshape(room, move.polygon, move)
      }),
    resizeRoom: (width, depth) =>
      applyShapeChange('Redimensionner la pièce', (room) => {
        if (!rectangleSize(room.floorPolygon)) return null
        const minimum = MIN_WALL_LENGTH
        return reshape(room, resizeRectangle(room.floorPolygon, Math.max(Math.round(width), minimum), Math.max(Math.round(depth), minimum)), null)
      }),
    updateRoomSettings: (patch) =>
      applyShapeChange('Modifier la pièce', (room) => ({
        ...shapeOf(room),
        ceilingHeight: clampTo(patch.ceilingHeight ?? room.ceilingHeight, ROOM_LIMITS.ceilingHeight),
        wallThickness: clampTo(patch.wallThickness ?? room.wallThickness, ROOM_LIMITS.wallThickness),
      })),

    upsertModel: (model) => set({ models: { ...get().models, [model.id]: model } }),
    customiseInstance: (instanceId, definition) =>
      applyInstancesChange('Personnaliser le meuble', (instances, context) => {
        const instance = instances.find((candidate) => candidate.id === instanceId)
        if (!instance) return instances
        // The size may have changed: re-placing the item keeps it inside the room.
        const customised = instances.map((candidate) =>
          candidate.id === instanceId ? { ...candidate, parametricOverride: definition } : candidate,
        )
        return placeItem(customised, instanceId, instance, context)
      }),
  }
})

export const useActiveRoom = (): RoomDto | undefined =>
  usePlannerStore((state) => state.rooms.find((room) => room.id === state.activeRoomId))
