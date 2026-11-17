import { createProject, createRoom, getProject } from '../api/generated/api'
import type { ProjectDto, RoomDto, RoomRequest } from '../api/generated/model'
import { ApiError } from '../api/http'
import { rectanglePolygon } from '../planner/geometry'

const PROJECT_STORAGE_KEY = 'configurator.projectId'
export const DEFAULT_WALL_THICKNESS = 100

export const toRoomRequest = (room: RoomDto, overrides: Partial<RoomRequest> = {}): RoomRequest => ({
  name: room.name,
  floorPolygon: room.floorPolygon,
  ceilingHeight: room.ceilingHeight,
  wallThickness: room.wallThickness,
  floorMaterialId: room.floorMaterialId,
  wallMaterialId: room.wallMaterialId,
  sortOrder: room.sortOrder,
  positionX: room.positionX,
  positionZ: room.positionZ,
  groupName: room.groupName,
  isHidden: room.isHidden,
  ...overrides,
})

/** Reopens the project remembered by this browser, or creates one with a first room. */
export const loadOrCreateProject = async (): Promise<{ project: ProjectDto; rooms: RoomDto[] }> => {
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
  const room = await createRoom(project.id, {
    name: 'Salon',
    floorPolygon: rectanglePolygon(5000, 4000),
    ceilingHeight: 2500,
    wallThickness: DEFAULT_WALL_THICKNESS,
    sortOrder: 0,
    positionX: 0,
    positionZ: 0,
    isHidden: false,
  })
  return { project, rooms: [room] }
}
