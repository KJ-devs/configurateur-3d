import type { Divider, Layout } from './layout'
import { MIN_COMPARTMENT } from './limits'
import type { Axis, Content, FurnitureNode, LeafNode, ParametricFurniture, Size, SplitNode } from './schema'

/** Where a node sits: its parent split and its index among the children. */
export type Slot = { split: SplitNode; index: number }

const flex = (weight = 1): Size => ({ mode: 'flex', weight })

export const findNode = (node: FurnitureNode, id: string): FurnitureNode | null => {
  if (node.id === id) return node
  if (node.type === 'leaf') return null
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

export const findLeaf = (furniture: ParametricFurniture, id: string): LeafNode | null => {
  const node = findNode(furniture.root, id)
  return node?.type === 'leaf' ? node : null
}

/** Splits from the root down to the node, each with the index of the child leading to it. */
export const pathTo = (node: FurnitureNode, id: string): Slot[] | null => {
  if (node.id === id) return []
  if (node.type === 'leaf') return null
  for (const [index, child] of node.children.entries()) {
    const path = pathTo(child, id)
    if (path) return [{ split: node, index }, ...path]
  }
  return null
}

const replaceNode = (node: FurnitureNode, id: string, update: (node: FurnitureNode) => FurnitureNode): FurnitureNode => {
  if (node.id === id) return update(node)
  if (node.type === 'leaf') return node
  return { ...node, children: node.children.map((child) => replaceNode(child, id, update)) }
}

const updateRoot = (
  furniture: ParametricFurniture,
  id: string,
  update: (node: FurnitureNode) => FurnitureNode,
): ParametricFurniture => ({ ...furniture, root: replaceNode(furniture.root, id, update) })

const updateSplit = (furniture: ParametricFurniture, splitId: string, update: (split: SplitNode) => FurnitureNode) =>
  updateRoot(furniture, splitId, (node) => (node.type === 'split' ? update(node) : node))

/**
 * New sizes for a split where the children listed in `changes` get a new inner length and the others keep theirs.
 * Flexible children stay flexible: their weight is rescaled with the split's current weight per millimetre.
 */
export const withLengths = (sizes: Size[], lengths: number[], changes: Map<number, number>): Size[] => {
  let flexWeight = 0
  let flexLength = 0
  sizes.forEach((size, index) => {
    if (size.mode !== 'flex') return
    flexWeight += size.weight
    flexLength += lengths[index]
  })
  const weightPerMm = flexLength > 0 ? flexWeight / flexLength : 0

  return sizes.map((size, index) => {
    const length = changes.get(index)
    if (length === undefined) return size
    if (size.mode === 'fixed' || weightPerMm === 0) return { mode: 'fixed', mm: Math.round(length) }
    return flex(length * weightPerMm)
  })
}

export const setContent = (furniture: ParametricFurniture, cellId: string, content: Content): ParametricFurniture =>
  updateRoot(furniture, cellId, (node) => (node.type === 'leaf' ? { ...node, content } : node))

type FurnitureOption = 'color' | 'frontColor' | 'handle' | 'slidingDoors'

/** Sets an optional setting of the whole piece; null removes it so the default applies again. */
export const setOption = <K extends FurnitureOption>(
  furniture: ParametricFurniture,
  key: K,
  value: NonNullable<ParametricFurniture[K]> | null,
): ParametricFurniture => {
  const updated = { ...furniture }
  if (value === null) delete updated[key]
  else updated[key] = value
  return updated
}

/** Paints one compartment, or gives it back the furniture's colours with null. */
export const setCellColor = (furniture: ParametricFurniture, cellId: string, color: string | null): ParametricFurniture =>
  updateRoot(furniture, cellId, (node) => {
    if (node.type !== 'leaf') return node
    const painted: LeafNode = { id: node.id, type: 'leaf', content: node.content }
    return color ? { ...painted, color } : painted
  })

/**
 * Cuts a compartment in two along `axis`; the new half copies the content.
 * Inside a split of the same axis the new compartment becomes a sibling, which keeps the tree flat
 * and leaves the other compartments of that split untouched.
 */
export const splitCell = (
  furniture: ParametricFurniture,
  layout: Layout,
  cellId: string,
  axis: Axis,
): { furniture: ParametricFurniture; newCellId: string } => {
  const leaf = findLeaf(furniture, cellId)
  const newCellId = crypto.randomUUID()
  if (!leaf) return { furniture, newCellId: cellId }

  const sibling: LeafNode = { ...leaf, id: newCellId }
  const parent = pathTo(furniture.root, cellId)?.at(-1)
  const lengths = parent && layout.splitLengths[parent.split.id]
  if (parent && lengths && parent.split.axis === axis) {
    const halfLength = Math.max(0, (lengths[parent.index] - furniture.panelThickness) / 2)
    const half = withLengths(parent.split.sizes, lengths, new Map([[parent.index, halfLength]]))[parent.index]
    const updated = updateSplit(furniture, parent.split.id, (split) => ({
      ...split,
      sizes: split.sizes.toSpliced(parent.index, 1, half, half),
      children: split.children.toSpliced(parent.index + 1, 0, sibling),
    }))
    return { furniture: updated, newCellId }
  }

  const split: SplitNode = { id: crypto.randomUUID(), type: 'split', axis, sizes: [flex(), flex()], children: [leaf, sibling] }
  return { furniture: updateRoot(furniture, cellId, () => split), newCellId }
}

/**
 * Removes a compartment and gives its space to the neighbour before it (after it for the first one).
 * Returns the id of the compartment that grew, or null when there is nothing to merge with.
 */
export const mergeCell = (
  furniture: ParametricFurniture,
  layout: Layout,
  cellId: string,
): { furniture: ParametricFurniture; keptId: string } | null => {
  const parent = pathTo(furniture.root, cellId)?.at(-1)
  const lengths = parent && layout.splitLengths[parent.split.id]
  if (!parent || !lengths) return null

  const { split, index } = parent
  const neighbour = index > 0 ? index - 1 : 1
  const grown = lengths[neighbour] + lengths[index] + furniture.panelThickness
  const sizes = withLengths(split.sizes, lengths, new Map([[neighbour, grown]])).toSpliced(index, 1)
  const children = split.children.toSpliced(index, 1)
  const kept = split.children[neighbour]
  const updated = updateSplit(furniture, split.id, () => (children.length === 1 ? kept : { ...split, sizes, children }))
  return { furniture: updated, keptId: firstLeafId(kept) }
}

const firstLeafId = (node: FurnitureNode): string => (node.type === 'leaf' ? node.id : firstLeafId(node.children[0]))

/** Moves a separator by `delta` mm (positive = right or up), keeping both neighbours above the minimum size. */
export const moveDivider = (furniture: ParametricFurniture, layout: Layout, divider: Divider, delta: number): ParametricFurniture => {
  const lengths = layout.splitLengths[divider.splitId]
  if (!lengths) return furniture

  const before = lengths[divider.index]
  const after = lengths[divider.index + 1]
  const clamped = Math.min(Math.max(delta, MIN_COMPARTMENT - before), after - MIN_COMPARTMENT)
  if (Math.abs(clamped) < 1) return furniture

  const changes = new Map([
    [divider.index, before + clamped],
    [divider.index + 1, after - clamped],
  ])
  return updateSplit(furniture, divider.splitId, (split) => ({ ...split, sizes: withLengths(split.sizes, lengths, changes) }))
}

/** The split that controls the width (`x`) or height (`y`) of a compartment, if any. */
export const sizeSlot = (furniture: ParametricFurniture, cellId: string, axis: Axis): Slot | null =>
  pathTo(furniture.root, cellId)?.findLast((slot) => slot.split.axis === axis) ?? null

/** Gives a child an exact inner length; flexible siblings absorb the difference, otherwise the next sibling does. */
export const setChildLength = (furniture: ParametricFurniture, layout: Layout, slot: Slot, length: number): ParametricFurniture => {
  const lengths = layout.splitLengths[slot.split.id]
  if (!lengths) return furniture

  const { sizes } = slot.split
  const flexSiblings = sizes.flatMap((size, index) => (size.mode === 'flex' && index !== slot.index ? [index] : []))
  const absorbers = flexSiblings.length > 0 ? flexSiblings : [slot.index + 1 < sizes.length ? slot.index + 1 : slot.index - 1]
  const spare = absorbers.reduce((total, index) => total + lengths[index] - MIN_COMPARTMENT, 0)
  const target = Math.round(Math.min(Math.max(length, MIN_COMPARTMENT), lengths[slot.index] + spare))

  const fixed: Size[] = sizes.with(slot.index, { mode: 'fixed', mm: target })
  const newSizes =
    flexSiblings.length > 0
      ? fixed
      : withLengths(fixed, lengths, new Map([[absorbers[0], lengths[absorbers[0]] - (target - lengths[slot.index])]]))
  return updateSplit(furniture, slot.split.id, (split) => ({ ...split, sizes: newSizes }))
}

/** Makes a child flexible again without changing its current length. */
export const setChildAuto = (furniture: ParametricFurniture, layout: Layout, slot: Slot): ParametricFurniture => {
  const lengths = layout.splitLengths[slot.split.id]
  if (!lengths || slot.split.sizes[slot.index].mode === 'flex') return furniture

  const otherFlex = slot.split.sizes.flatMap((size, index) => (size.mode === 'flex' ? [{ weight: size.weight, length: lengths[index] }] : []))
  const weightPerMm = otherFlex.reduce((total, { weight }) => total + weight, 0) / otherFlex.reduce((total, { length }) => total + length, 0)
  const weight = otherFlex.length > 0 && Number.isFinite(weightPerMm) && weightPerMm > 0 ? lengths[slot.index] * weightPerMm : 1
  return updateSplit(furniture, slot.split.id, (split) => ({ ...split, sizes: split.sizes.with(slot.index, flex(weight)) }))
}

/** All children of the split become flexible with the same weight. */
export const distributeEvenly = (furniture: ParametricFurniture, splitId: string): ParametricFurniture =>
  updateSplit(furniture, splitId, (split) => ({ ...split, sizes: split.sizes.map(() => flex()) }))
