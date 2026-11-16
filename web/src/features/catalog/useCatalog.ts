import { useEffect, useState } from 'react'
import { getFurnitureCategories, getFurnitureModels, getMaterials } from '../../api/generated/api'
import type { FurnitureModelDto, MaterialDto } from '../../api/generated/model'

const SEARCH_DEBOUNCE_MS = 250

export type CatalogFilters = { search: string; category: string | null }

type CatalogState = {
  models: FurnitureModelDto[]
  categories: string[]
  materials: MaterialDto[]
  status: 'loading' | 'ready' | 'error'
}

export const useCatalog = ({ search, category }: CatalogFilters): CatalogState => {
  const [models, setModels] = useState<FurnitureModelDto[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [materials, setMaterials] = useState<MaterialDto[]>([])
  const [status, setStatus] = useState<CatalogState['status']>('loading')

  useEffect(() => {
    const controller = new AbortController()
    const loadReferenceData = async () => {
      try {
        const [loadedCategories, loadedMaterials] = await Promise.all([
          getFurnitureCategories({ signal: controller.signal }),
          getMaterials({ signal: controller.signal }),
        ])
        setCategories(loadedCategories)
        setMaterials(loadedMaterials)
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }
    void loadReferenceData()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadModels = async () => {
      try {
        const params = { search: search || undefined, category: category ?? undefined }
        setModels(await getFurnitureModels(params, { signal: controller.signal }))
        setStatus('ready')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }
    const timer = setTimeout(() => void loadModels(), SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, category])

  return { models, categories, materials, status }
}
