import { create } from 'zustand'
import { createFurnitureModel, updateFurnitureModel } from '../api/generated/api'
import type { FurnitureModelDto, FurnitureModelRequest, MaterialDto } from '../api/generated/model'
import { estimatePrice } from '../engine/analysis'
import { definitionOf } from '../engine/furniture'
import { computeLayout } from '../engine/layout'
import { createDefaultFurniture, DEFAULT_PANEL_THICKNESS } from '../engine/limits'
import type { ParametricFurniture } from '../engine/schema'
import { findLeaf } from '../engine/tree'
import { HISTORY_LIMIT } from './history'
import { usePlannerStore } from './plannerStore'

export type BuilderSource = { kind: 'new' } | { kind: 'model'; modelId: string } | { kind: 'instance'; instanceId: string }

/** apply: customise the placed item · update: overwrite the catalog model · create: add a new catalog model. */
export type SaveMode = 'apply' | 'update' | 'create'

export type BuilderStart = { furniture: ParametricFurniture; name: string; category: string }

export const DEFAULT_NAME = 'Mon meuble sur mesure'
export const DEFAULT_CATEGORY = 'Sur mesure'

type BuilderState = {
  source: BuilderSource | null
  furniture: ParametricFurniture | null
  name: string
  category: string
  selectedCellId: string | null
  showFronts: boolean
  past: ParametricFurniture[]
  future: ParametricFurniture[]
  isSaving: boolean
  error: string | null

  /** A new piece can start from a template or a copy of another one instead of the default box. */
  open: (source: BuilderSource, start?: BuilderStart) => void
  close: () => void
  /** Consecutive edits sharing a merge key (a slider, a drag) form a single undo step. */
  edit: (update: (furniture: ParametricFurniture) => ParametricFurniture, mergeKey?: string) => void
  endGesture: () => void
  undo: () => void
  redo: () => void
  selectCell: (cellId: string | null) => void
  setName: (name: string) => void
  setCategory: (category: string) => void
  toggleFronts: () => void
  save: (mode: SaveMode) => Promise<void>
}

const isPanelMaterial = (material: MaterialDto): boolean => material.kind === 'Wood' || material.kind === 'Lacquer'

export const panelMaterials = (materials: Record<string, MaterialDto>): MaterialDto[] => Object.values(materials).filter(isPanelMaterial)

const findInstance = (instanceId: string) =>
  usePlannerStore.getState().rooms.flatMap((room) => room.instances).find((instance) => instance.id === instanceId)

const initialState = (source: BuilderSource): { furniture: ParametricFurniture | null; name: string; category: string } => {
  const { models, materials } = usePlannerStore.getState()
  if (source.kind === 'new') {
    const material = panelMaterials(materials)[0]
    const furniture = material ? createDefaultFurniture(material.id, material.thicknesses[0] ?? DEFAULT_PANEL_THICKNESS) : null
    return { furniture, name: DEFAULT_NAME, category: DEFAULT_CATEGORY }
  }

  const instance = source.kind === 'instance' ? findInstance(source.instanceId) : undefined
  const model = models[source.kind === 'model' ? source.modelId : (instance?.furnitureModelId ?? '')]
  return { furniture: definitionOf(model, instance), name: model?.name ?? DEFAULT_NAME, category: model?.category ?? DEFAULT_CATEGORY }
}

const toRequest = (furniture: ParametricFurniture, name: string, category: string, base?: FurnitureModelDto): FurnitureModelRequest => {
  const material = usePlannerStore.getState().materials[furniture.materialId]
  return {
    name: name.trim() || DEFAULT_NAME,
    category: category.trim() || DEFAULT_CATEGORY,
    type: 'Parametric',
    width: furniture.width,
    height: furniture.height,
    depth: furniture.depth,
    parametricDefinition: furniture,
    thumbnailUrl: base?.thumbnailUrl ?? null,
    basePrice: material ? estimatePrice(computeLayout(furniture), material.pricePerM2, furniture.color !== undefined).price : null,
    materialId: furniture.materialId,
  }
}

export const useBuilderStore = create<BuilderState>((set, get) => {
  let lastMergeKey: string | null = null

  /** Keeps the selection only when the compartment still exists. */
  const restore = (furniture: ParametricFurniture) => {
    const { selectedCellId } = get()
    set({ furniture, selectedCellId: selectedCellId && findLeaf(furniture, selectedCellId) ? selectedCellId : null })
  }

  const saveModel = async (mode: SaveMode, furniture: ParametricFurniture) => {
    const { source, name, category } = get()
    const planner = usePlannerStore.getState()
    if (!source) return

    if (mode === 'apply' && source.kind === 'instance') return planner.customiseInstance(source.instanceId, furniture)
    if (mode === 'update' && source.kind === 'model') {
      const model = await updateFurnitureModel(source.modelId, toRequest(furniture, name, category, planner.models[source.modelId]))
      return planner.upsertModel(model)
    }

    const model = await createFurnitureModel(toRequest(furniture, name, category))
    planner.upsertModel(model)
    if (source.kind === 'new') planner.addInstanceAtCenter(model.id)
    if (source.kind === 'instance') planner.customiseInstance(source.instanceId, furniture)
  }

  return {
    source: null,
    furniture: null,
    name: '',
    category: '',
    selectedCellId: null,
    showFronts: true,
    past: [],
    future: [],
    isSaving: false,
    error: null,

    open: (source, start) => {
      const initial = start ?? initialState(source)
      if (!initial.furniture) return
      lastMergeKey = null
      set({ ...initial, source, selectedCellId: null, showFronts: true, past: [], future: [], isSaving: false, error: null })
    },
    close: () => set({ source: null, furniture: null, past: [], future: [], selectedCellId: null }),

    edit: (update, mergeKey) => {
      const { furniture, past } = get()
      if (!furniture) return
      const updated = update(furniture)
      if (updated === furniture) return

      const isMerged = mergeKey !== undefined && mergeKey === lastMergeKey
      lastMergeKey = mergeKey ?? null
      set({ furniture: updated, past: isMerged ? past : [...past, furniture].slice(-HISTORY_LIMIT), future: [] })
    },
    endGesture: () => {
      lastMergeKey = null
    },
    undo: () => {
      const { furniture, past, future } = get()
      const previous = past.at(-1)
      if (!furniture || !previous) return
      lastMergeKey = null
      set({ past: past.slice(0, -1), future: [furniture, ...future] })
      restore(previous)
    },
    redo: () => {
      const { furniture, past, future } = get()
      const [next, ...rest] = future
      if (!furniture || !next) return
      lastMergeKey = null
      set({ past: [...past, furniture], future: rest })
      restore(next)
    },

    selectCell: (cellId) => set({ selectedCellId: cellId }),
    setName: (name) => set({ name }),
    setCategory: (category) => set({ category }),
    toggleFronts: () => set({ showFronts: !get().showFronts }),

    save: async (mode) => {
      const { furniture } = get()
      if (!furniture || get().isSaving) return

      set({ isSaving: true, error: null })
      try {
        await saveModel(mode, furniture)
        get().close()
      } catch {
        set({ error: "L'enregistrement a échoué. Vérifiez que l'API est démarrée puis réessayez." })
      } finally {
        set({ isSaving: false })
      }
    },
  }
})
