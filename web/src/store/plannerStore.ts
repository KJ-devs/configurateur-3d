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
  boundsCenter,
  clampToBounds,
  footprintHalfExtents,
  polygonBounds,
  rectanglePolygon,
  type Point,
} from '../planner/geometry'

const PROJECT_STORAGE_KEY = 'configurator.projectId'
const AUTOSAVE_DELAY_MS = 800
const DEFAULT_WALL_THICKNESS = 100

export type ViewMode = '2d' | '3d'
export type SaveStatus = 'saved' | 'saving' | 'error'
export type NewRoomInput = { name: string; width: number; depth: number; ceilingHeight: number }

type Ghost = { modelId: string; position: Point | null }

type PlannerState = {
  status: 'loading' | 'ready' | 'error'
  project: ProjectDto | null
  rooms: RoomDto[]
  activeRoomId: string | null
  models: Record<string, FurnitureModelDto>
  materials: Record<string, MaterialDto>
  selectedIds: string[]
  viewMode: ViewMode
  ghost: Ghost | null
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
  requestFrame: () => void
  select: (instanceId: string) => void
  clearSelection: () => void
  setDragging: (isDragging: boolean) => void
  startCatalogDrag: (modelId: string) => void
  moveGhost: (position: Point | null) => void
  dropGhost: () => void
  endCatalogDrag: () => void
  addInstanceAtCenter: (modelId: string) => void
  moveInstance: (instanceId: string, position: Point) => void
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

  const updateActiveInstances = (update: (instances: FurnitureInstanceDto[]) => FurnitureInstanceDto[]) => {
    const { activeRoomId, rooms } = get()
    if (!activeRoomId) return

    set({
      rooms: rooms.map((room) => (room.id === activeRoomId ? { ...room, instances: update(room.instances) } : room)),
    })
    scheduleSave(activeRoomId)
  }

  const addInstance = (modelId: string, position: Point) => {
    const { activeRoomId, models, rooms } = get()
    const room = rooms.find((candidate) => candidate.id === activeRoomId)
    const model = models[modelId]
    if (!room || !model) return

    const { halfX, halfZ } = footprintHalfExtents(model.width, model.depth, 0)
    const clamped = clampToBounds(position, halfX, halfZ, polygonBounds(room.floorPolygon))
    const instance: FurnitureInstanceDto = {
      id: crypto.randomUUID(),
      roomId: room.id,
      furnitureModelId: modelId,
      x: Math.round(clamped.x),
      z: Math.round(clamped.z),
      rotationY: 0,
    }
    updateActiveInstances((instances) => [...instances, instance])
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
    ghost: null,
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
      const room = get().rooms.find((candidate) => candidate.id === roomId)
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
    requestFrame: () => set({ frameRequest: get().frameRequest + 1 }),
    select: (instanceId) => set({ selectedIds: [instanceId] }),
    clearSelection: () => {
      if (get().selectedIds.length > 0) set({ selectedIds: [] })
    },
    setDragging: (isDragging) => set({ isDragging }),

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
      const room = get().rooms.find((candidate) => candidate.id === get().activeRoomId)
      if (room) addInstance(modelId, boundsCenter(polygonBounds(room.floorPolygon)))
    },

    moveInstance: (instanceId, position) =>
      updateActiveInstances((instances) =>
        instances.map((instance) =>
          instance.id === instanceId ? { ...instance, x: Math.round(position.x), z: Math.round(position.z) } : instance,
        ),
      ),
  }
})

export const useActiveRoom = (): RoomDto | undefined =>
  usePlannerStore((state) => state.rooms.find((room) => room.id === state.activeRoomId))
