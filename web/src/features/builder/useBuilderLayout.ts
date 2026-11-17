import { useMemo } from 'react'
import { findIssues, type Issue } from '../../engine/analysis'
import { computeLayout, type Layout } from '../../engine/layout'
import type { ParametricFurniture } from '../../engine/schema'
import { useBuilderStore } from '../../store/builderStore'

type BuilderLayout = { furniture: ParametricFurniture; layout: Layout; issues: Issue[] }

/** The furniture being edited with its computed layout. Only call it below a check that the builder is open. */
export const useBuilderLayout = (): BuilderLayout | null => {
  const furniture = useBuilderStore((state) => state.furniture)
  return useMemo(() => {
    if (!furniture) return null
    const layout = computeLayout(furniture)
    return { furniture, layout, issues: findIssues(furniture, layout) }
  }, [furniture])
}
