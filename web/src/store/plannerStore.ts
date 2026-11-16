import { create } from 'zustand'
import {
  createProject,
  createRoom as createRoomRequest,
  deleteRoom as deleteRoomRequest,
  duplicateRoom as duplicateRoomRequest,
  getFurnitureModels,
  getMaterials,
  getProject,
  syncInstances,
  updateRoom,
} from '../api/generated/api'
import type {
  FurnitureInstanceDto,
  FurnitureModelDto,
  MaterialDto,
  ProjectDto,
  RoomDto,
  RoomRequest,
} from '../api/generated/model'
import { ApiError } from '../api/http'
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
import { boundsCenter, polygonBounds, rectanglePolygon, type Point } from '../planner/geometry'
import type { Guide } from '../planner/snapping'
import { useHistoryStore } from './history'

const PROJECT_STORAGE_KEY = 'configurator.projectId'
const AUTOSAVE_DELAY_MS = 800
const DEFAULT_WALL_THICKNESS = 100
const DEFAULT_GRID_SIZE = 50

export type ViewMode = '2d' | '3d'
export type SaveStatus = 'saved' | 'saving' | 'error'
export type NewRoomInput = { name: string; width: number; depth: number; ceilingHeight: number }

type Ghost = { modelId: string; position: Point | null }
type DragSession = { roomId: string; snapshot: FurnitureInstanceDto[]; label: string }
type InstancesUpdate = (instances: FurnitureInstanceDto[], context: EditContext<FurnitureInstanceDto>) => FurnitureInstanceDto[]

type PlannerState = {
  status: 'loading' | 'ready' | 'error'
  project: ProjectDto | null
  rooms: RoomDto[]
  activeRoomId: string | null
  models: Record<string, FurnitureModelDto>
  materials: Record<string, MaterialDto>
  selectedIds: string[]
  viewMode: ViewMode
  gridSize: number
  ghost: Ghost | null
  guides: Guide[]
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
  setGridSize: (gridSize: number) => void
  requestFrame: () => void

  select: (instanceId: string, isAdditive?: boolean) => void
  setSelection: (instanceIds: string[]) => void
  clearSelection: () => void

  startCatalogDrag: (modelId: string) => void
  moveGhost: (position: Point | null) => void
  dropGhost: () => void
  endCatalogDrag: () => void
  addInstanceAtCenter: (modelId: string) => void

  /** A drag previews changes live and becomes a single undo step when it ends. */
  beginDrag: (label: string) => void
  dragSelectionBy: (delta: Point, isSnapEnabled: boolean) => void
  dragRotationTo: (instanceId: string, degrees: number) => void
  endDrag: () => void

  rotateSelected: (deltaDegrees: number) => void
  nudgeSelected: (delta: Point) => void
  duplicateSelected: () => void
  deleteSelected: () => void
  setSelectedColor: (color: string | null) => void
  placeInstance: (instanceId: string, position: Point) => void
}

const toRoomRequest = (room: RoomDto, overrides: Partial<RoomRequest> = {}): RoomRequest => ({
  name: room.name,
  floorPolygon: room.floorPolygon,
  ceilingHeight: room.ceilingHeight,
  wallThickness: room.wallThickness,
  floorMaterialId: room.floorMaterialId,
  wallMaterialId: room.wallMaterialId,
  sortOrder: room.sortOrder,
  ...overrides,
})

const indexById = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

const loadOrCreateProject = async (): Promise<{ project: ProjectDto; rooms: RoomDto[] }> => {
  const storedId = localStorage.getItem(PROJECT_STORAGE_KEY)
  if (storedId) {
    try {
      const { rooms, ...project } = await getProject(storedId)
      return { project, rooms }
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error
    }
  }

  const project = await createProject({ name: 'Mon projet' })
  localStorage.setItem(PROJECT_STORAGE_KEY, project.id)
  const room = await createRoomRequest(project.id, {
    name: 'Salon',
    floorPolygon: rectanglePolygon(5000, 4000),
    ceilingHeight: 2500,
    wallThickness: DEFAULT_WALL_THICKNESS,
    sortOrder: 0,
  })
  return { project, rooms: [room] }
}

export const usePlannerStore = create<PlannerState>((set, get) => {
  const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let hasInitStarted = false
  let dragSession: DragSession | null = null

  const saveRoomInstances = async (roomId: string) => {
    saveTimers.delete(roomId)
    const room = get().rooms.find((candidate) => candidate.id === roomId)
    if (!room) return

    try {
      await syncInstances(roomId, { instances: room.instances })
      if (saveTimers.size === 0) set({ saveStatus: 'saved' })
    } catch {
      set({ saveStatus: 'error' })
    }
  }

  const scheduleSave = (roomId: string) => {
    clearTimeout(saveTimers.get(roomId))
    saveTimers.set(roomId, setTimeout(() => void saveRoomInstances(roomId), AUTOSAVE_DELAY_MS))
    set({ saveStatus: 'saving' })
  }

  const findRoom = (roomId: string | null): RoomDto | undefined => get().rooms.find((room) => room.id === roomId)

  const editContext = (room: RoomDto): EditContext<FurnitureInstanceDto> => ({
    sizeOf: (instance) => get().models[instance.furnitureModelId],
    polygon: room.floorPolygon,
    wallThickness: room.wallThickness,
    gridSize: get().gridSize,
  })

  /** Replaces the instances of a room without touching the history. */
  const setRoomInstances = (roomId: string, instances: FurnitureInstanceDto[]) => {
    const existingIds = new Set(instances.map((instance) => instance.id))
    set({
      rooms: get().rooms.map((room) => (room.id === roomId ? { ...room, instances } : room)),
      selectedIds: get().activeRoomId === roomId ? get().selectedIds.filter((id) => existingIds.has(id)) : get().selectedIds,
    })
    scheduleSave(roomId)
  }

  const recordChange = (label: string, roomId: string, before: FurnitureInstanceDto[], after: FurnitureInstanceDto[]) =>
    useHistoryStore.getState().record({
      label,
      undo: () => setRoomInstances(roomId, before),
      redo: () => setRoomInstances(roomId, after),
    })

  /** Applies an edit to the active room as one undo step. Returns the new instances. */
  const applyChange = (label: string, update: InstancesUpdate): FurnitureInstanceDto[] | null => {
    const room = findRoom(get().activeRoomId)
    if (!room) return null

    const after = update(room.instances, editContext(room))
    if (after === room.instances) return null
    setRoomInstances(room.id, after)
    recordChange(label, room.id, room.instances, after)
    return after
  }

  const previewDrag = (update: InstancesUpdate, guides: Guide[] = []) => {
    const room = dragSession && findRoom(dragSession.roomId)
    if (!dragSession || !room) return

    set({
      rooms: get().rooms.map((candidate) =>
        candidate.id === room.id ? { ...candidate, instances: update(dragSession!.snapshot, editContext(room)) } : candidate,
      ),
      guides,
    })
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
    applyChange('Ajouter un meuble', (instances, context) => {
      const free = freePositionFor(instance, instances, context)
      return [...instances, { ...instance, x: Math.round(free.x), z: Math.round(free.z) }]
    })
    set({ selectedIds: [instance.id] })
  }

  const replaceRoom = (room: RoomDto) =>
    set({ rooms: get().rooms.map((candidate) => (candidate.id === room.id ? room : candidate)) })

  return {
    status: 'loading',
    project: null,
    rooms: [],
    activeRoomId: null,
    models: {},
    materials: {},
    selectedIds: [],
    viewMode: '3d',
    gridSize: DEFAULT_GRID_SIZE,
    ghost: null,
    guides: [],
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
      } catch {
        set({ status: 'error' })
      }
    },

    createRoom: async ({ name, width, depth, ceilingHeight }) => {
      const { project, rooms } = get()
      if (!project) return

      const room = await createRoomRequest(project.id, {
        name,
        floorPolygon: rectanglePolygon(width, depth),
        ceilingHeight,
        wallThickness: DEFAULT_WALL_THICKNESS,
        sortOrder: rooms.length,
      })
      set({ rooms: [...get().rooms, room], activeRoomId: room.id, selectedIds: [] })
    },

    renameRoom: async (roomId, name) => {
      const room = findRoom(roomId)
      if (!room || room.name === name) return

      replaceRoom({ ...room, name })
      await updateRoom(roomId, toRoomRequest(room, { name }))
    },

    duplicateRoom: async (roomId) => {
      const copy = await duplicateRoomRequest(roomId)
      set({ rooms: [...get().rooms, copy], activeRoomId: copy.id, selectedIds: [] })
    },

    deleteRoom: async (roomId) => {
      await deleteRoomRequest(roomId)
      const rooms = get().rooms.filter((room) => room.id !== roomId)
      const activeRoomId = get().activeRoomId === roomId ? (rooms[0]?.id ?? null) : get().activeRoomId
      set({ rooms, activeRoomId, selectedIds: [] })
    },

    setActiveRoom: (roomId) => set({ activeRoomId: roomId, selectedIds: [] }),
    setViewMode: (viewMode) => set({ viewMode }),
    setGridSize: (gridSize) => set({ gridSize }),
    requestFrame: () => set({ frameRequest: get().frameRequest + 1 }),

    select: (instanceId, isAdditive = false) => {
      const { selectedIds } = get()
      if (!isAdditive) return set({ selectedIds: [instanceId] })
      set({
        selectedIds: selectedIds.includes(instanceId)
          ? selectedIds.filter((id) => id !== instanceId)
          : [...selectedIds, instanceId],
      })
    },
    setSelection: (instanceIds) => set({ selectedIds: instanceIds }),
    clearSelection: () => {
      if (get().selectedIds.length > 0) set({ selectedIds: [] })
    },

    startCatalogDrag: (modelId) => set({ ghost: { modelId, position: null } }),
    moveGhost: (position) => {
      const { ghost } = get()
      if (ghost) set({ ghost: { ...ghost, position } })
    },
    dropGhost: () => {
      const { ghost } = get()
      if (ghost?.position) addInstance(ghost.modelId, ghost.position)
      set({ ghost: null })
    },
    endCatalogDrag: () => set({ ghost: null }),
    addInstanceAtCenter: (modelId) => {
      const room = findRoom(get().activeRoomId)
      if (room) addInstance(modelId, boundsCenter(polygonBounds(room.floorPolygon)))
    },

    beginDrag: (label) => {
      const room = findRoom(get().activeRoomId)
      if (!room) return
      dragSession = { roomId: room.id, snapshot: room.instances, label }
      set({ isDragging: true })
    },
    dragSelectionBy: (delta, isSnapEnabled) => {
      if (!dragSession) return
      const room = findRoom(dragSession.roomId)
      if (!room) return

      const { items, guides } = dragItems(dragSession.snapshot, get().selectedIds, delta, editContext(room), isSnapEnabled)
      previewDrag(() => items, guides)
    },
    dragRotationTo: (instanceId, degrees) =>
      previewDrag((snapshot, context) => rotateItemTo(snapshot, instanceId, degrees, context)),
    endDrag: () => {
      const session = dragSession
      dragSession = null
      set({ isDragging: false, guides: [] })
      const room = session && findRoom(session.roomId)
      if (!session || !room || room.instances === session.snapshot) return

      scheduleSave(room.id)
      recordChange(session.label, room.id, session.snapshot, room.instances)
    },

    rotateSelected: (deltaDegrees) => {
      if (get().selectedIds.length === 0) return
      applyChange('Tourner', (instances, context) => rotateItems(instances, get().selectedIds, deltaDegrees, context))
    },
    nudgeSelected: (delta) => {
      if (get().selectedIds.length === 0) return
      applyChange('Déplacer', (instances, context) => nudgeItems(instances, get().selectedIds, delta, context))
    },
    duplicateSelected: () => {
      let createdIds: string[] = []
      applyChange('Dupliquer', (instances, context) => {
        const { items, newIds } = duplicateItems(instances, get().selectedIds, context, () => crypto.randomUUID())
        createdIds = newIds
        return newIds.length > 0 ? items : instances
      })
      if (createdIds.length > 0) set({ selectedIds: createdIds })
    },
    deleteSelected: () => {
      const { selectedIds } = get()
      if (selectedIds.length === 0) return
      applyChange('Supprimer', (instances) => instances.filter((instance) => !selectedIds.includes(instance.id)))
    },
    setSelectedColor: (color) => {
      const { selectedIds } = get()
      if (selectedIds.length === 0) return
      applyChange('Changer la couleur', (instances) =>
        instances.map((instance) => (selectedIds.includes(instance.id) ? { ...instance, colorOverride: color } : instance)),
      )
    },
    placeInstance: (instanceId, position) => {
      applyChange('Placer', (instances, context) => placeItem(instances, instanceId, position, context))
    },
  }
})

export const useActiveRoom = (): RoomDto | undefined =>
  usePlannerStore((state) => state.rooms.find((room) => room.id === state.activeRoomId))
