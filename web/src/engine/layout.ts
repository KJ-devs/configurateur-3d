import { BACK_THICKNESS } from './limits'
import type { Axis, Content, FurnitureNode, Hinge, LeafNode, ParametricFurniture, Size, SplitNode } from './schema'

/** Axis-aligned box in millimetres, from its minimum corner. Origin: bottom, left, back of the furniture. */
export type Box = { x: number; y: number; z: number; w: number; h: number; d: number }

/** Rectangle seen from the front (x to the right, y upwards). */
export type Rect = { x: number; y: number; w: number; h: number }

export type PartKind =
  | 'carcass'
  | 'back'
  | 'liner'
  | 'plinth'
  | 'separator'
  | 'shelf'
  | 'door'
  | 'glass'
  | 'flap'
  | 'drawer'
  | 'sliding'
  | 'handle'
  | 'rail'

/** `color` is set when the part does not take the base colour (carcass colour, else the material's). */
export type Part = { key: string; kind: PartKind; box: Box; cellId?: string; color?: string }

export type Cell = { id: string; rect: Rect; content: Content; color?: string }

/** Separation panel between child `index` and `index + 1` of a split. */
export type Divider = { key: string; splitId: string; index: number; axis: Axis; rect: Rect }

export type Layout = {
  parts: Part[]
  cells: Cell[]
  dividers: Divider[]
  /** Resolved inner length of each child, by split id. */
  splitLengths: Record<string, number[]>
  interior: Rect
  backZ: number
}

export const FRONT_KINDS = new Set<PartKind>(['door', 'glass', 'flap', 'drawer', 'sliding', 'handle'])

const FRONT_GAP = 3
const SHELF_SETBACK = 10
const SHELF_BEHIND_FRONT_GAP = 5
const PLINTH_SETBACK = 40
const HANDLE_THICKNESS = 12
const HANDLE_PROJECTION = 25
const KNOB_SIZE = 24
const HANDLE_MARGIN = 40
const DOOR_HANDLE_LENGTH = 160
const DRAWER_HANDLE_LENGTH = 200
const SLIDING_HANDLE_LENGTH = 300
const SLIDING_OVERLAP = 40
const SLIDING_TRACK_GAP = 2
const RAIL_DIAMETER = 25
const RAIL_TOP_OFFSET = 70
const LINER_THICKNESS = 1

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0)

/**
 * Inner sizes of the children of a split along a length, separators excluded.
 * Fixed sizes are kept, flex sizes share what remains; when fixed sizes do not fit, or nothing is flexible,
 * fixed sizes are scaled so the children always fill the length exactly.
 */
export const resolveSizes = (sizes: Size[], length: number, thickness: number): number[] => {
  const available = Math.max(0, length - thickness * (sizes.length - 1))
  const fixedTotal = sum(sizes.map((size) => (size.mode === 'fixed' ? size.mm : 0)))
  const flexTotal = sum(sizes.map((size) => (size.mode === 'flex' ? size.weight : 0)))

  if (flexTotal > 0 && fixedTotal <= available) {
    const remaining = available - fixedTotal
    return sizes.map((size) => (size.mode === 'fixed' ? size.mm : (remaining * size.weight) / flexTotal))
  }
  if (fixedTotal === 0) return sizes.map(() => available / sizes.length)
  const scale = available / fixedTotal
  return sizes.map((size) => (size.mode === 'fixed' ? size.mm * scale : 0))
}

type Context = Omit<Layout, 'interior'> & {
  furniture: ParametricFurniture
  /** Room kept in front of the compartments for the sliding door tracks. */
  frontInset: number
}

/** What a compartment is drawing into: where it is and which colours it uses. */
type Target = { context: Context; cellId: string; frontColor?: string; bodyColor?: string }

const frontZ = (context: Context): number => context.furniture.depth - context.furniture.panelThickness - context.frontInset

const frontBox = (rect: Rect, context: Context): Box => ({
  x: rect.x + FRONT_GAP,
  y: rect.y + FRONT_GAP,
  z: frontZ(context),
  w: Math.max(0, rect.w - FRONT_GAP * 2),
  h: Math.max(0, rect.h - FRONT_GAP * 2),
  d: context.furniture.panelThickness,
})

type Grip = { key: string; cellId?: string; x: number; y: number; z: number; length: number; isVertical: boolean }

const addHandle = (context: Context, { key, cellId, x, y, z, length, isVertical }: Grip) => {
  const style = context.furniture.handle ?? 'bar'
  if (style === 'none') return
  const w = style === 'knob' ? KNOB_SIZE : isVertical ? HANDLE_THICKNESS : length
  const h = style === 'knob' ? KNOB_SIZE : isVertical ? length : HANDLE_THICKNESS
  context.parts.push({ key, kind: 'handle', cellId, box: { x: x - w / 2, y: y - h / 2, z, w, h, d: HANDLE_PROJECTION } })
}

const addShelves = ({ context, cellId, bodyColor }: Target, rect: Rect, count: number, isBehindFront: boolean) => {
  const { panelThickness, depth } = context.furniture
  const frontLimit = isBehindFront ? frontZ(context) - SHELF_BEHIND_FRONT_GAP : depth - context.frontInset - SHELF_SETBACK
  const spacing = (rect.h - count * panelThickness) / (count + 1)
  for (let index = 1; index <= count; index++) {
    context.parts.push({
      key: `${cellId}:shelf:${index}`,
      kind: 'shelf',
      cellId,
      color: bodyColor,
      box: { x: rect.x, y: rect.y + index * spacing + (index - 1) * panelThickness, z: context.backZ, w: rect.w, h: panelThickness, d: frontLimit - context.backZ },
    })
  }
}

const addDoor = (target: Target, rect: Rect, hinge: Hinge, key: string, kind: 'door' | 'glass') => {
  const { context, cellId, frontColor } = target
  const box = frontBox(rect, context)
  context.parts.push({ key, kind, box, cellId, color: frontColor })
  addHandle(context, {
    key: `${key}:handle`,
    cellId,
    x: hinge === 'left' ? box.x + box.w - HANDLE_MARGIN : box.x + HANDLE_MARGIN,
    y: box.y + box.h / 2,
    z: box.z + box.d,
    length: Math.min(DOOR_HANDLE_LENGTH, box.h / 3),
    isVertical: true,
  })
}

const addFlap = ({ context, cellId, frontColor }: Target, rect: Rect) => {
  const box = frontBox(rect, context)
  context.parts.push({ key: `${cellId}:flap`, kind: 'flap', box, cellId, color: frontColor })
  addHandle(context, {
    key: `${cellId}:flap:handle`,
    cellId,
    x: box.x + box.w / 2,
    y: box.y + box.h - HANDLE_MARGIN,
    z: box.z + box.d,
    length: Math.min(DRAWER_HANDLE_LENGTH, box.w / 2),
    isVertical: false,
  })
}

const addDrawers = ({ context, cellId, frontColor }: Target, rect: Rect, count: number) => {
  const frontHeight = rect.h / count
  for (let index = 0; index < count; index++) {
    const box = frontBox({ ...rect, y: rect.y + index * frontHeight, h: frontHeight }, context)
    context.parts.push({ key: `${cellId}:drawer:${index}`, kind: 'drawer', box, cellId, color: frontColor })
    addHandle(context, {
      key: `${cellId}:drawer:${index}:handle`,
      cellId,
      x: box.x + box.w / 2,
      y: box.y + box.h / 2,
      z: box.z + box.d,
      length: Math.min(DRAWER_HANDLE_LENGTH, box.w / 2),
      isVertical: false,
    })
  }
}

const addRail = ({ context, cellId }: Target, rect: Rect) => {
  const { depth } = context.furniture
  const z = context.backZ + (depth - context.frontInset - context.backZ) / 2 - RAIL_DIAMETER / 2
  const y = rect.y + rect.h - RAIL_TOP_OFFSET
  context.parts.push({ key: `${cellId}:rail`, kind: 'rail', cellId, box: { x: rect.x, y, z, w: rect.w, h: RAIL_DIAMETER, d: RAIL_DIAMETER } })
}

const addContent = (target: Target, rect: Rect, content: Content) => {
  const { cellId } = target
  switch (content.kind) {
    case 'shelf':
      return addShelves(target, rect, content.count, false)
    case 'door':
    case 'glassDoor':
      addShelves(target, rect, content.shelves ?? 0, true)
      return addDoor(target, rect, content.hinge, `${cellId}:door`, content.kind === 'door' ? 'door' : 'glass')
    case 'doubleDoor': {
      const half = rect.w / 2
      addShelves(target, rect, content.shelves ?? 0, true)
      addDoor(target, { ...rect, w: half }, 'left', `${cellId}:door:left`, 'door')
      return addDoor(target, { ...rect, x: rect.x + half, w: half }, 'right', `${cellId}:door:right`, 'door')
    }
    case 'flap':
      return addFlap(target, rect)
    case 'drawer':
      return addDrawers(target, rect, content.count)
    case 'rail':
      return addRail(target, rect)
    case 'empty':
      return
  }
}

const layoutLeaf = (context: Context, leaf: LeafNode, rect: Rect) => {
  const { furniture } = context
  context.cells.push({ id: leaf.id, rect, content: leaf.content, color: leaf.color })
  if (leaf.color && furniture.hasBack) {
    context.parts.push({ key: `${leaf.id}:liner`, kind: 'liner', cellId: leaf.id, color: leaf.color, box: { ...rect, z: context.backZ, d: LINER_THICKNESS } })
  }
  addContent(
    { context, cellId: leaf.id, frontColor: leaf.color ?? furniture.frontColor, bodyColor: leaf.color },
    rect,
    leaf.content,
  )
}

const layoutSplit = (context: Context, split: SplitNode, rect: Rect) => {
  const { panelThickness, depth } = context.furniture
  const isColumns = split.axis === 'x'
  const sizes = resolveSizes(split.sizes, isColumns ? rect.w : rect.h, panelThickness)
  context.splitLengths[split.id] = sizes
  let cursor = isColumns ? rect.x : rect.y

  split.children.forEach((child, index) => {
    const size = sizes[index]
    layoutNode(context, child, isColumns ? { ...rect, x: cursor, w: size } : { ...rect, y: cursor, h: size })
    cursor += size
    if (index === split.children.length - 1) return

    const separator: Rect = isColumns
      ? { x: cursor, y: rect.y, w: panelThickness, h: rect.h }
      : { x: rect.x, y: cursor, w: rect.w, h: panelThickness }
    const key = `${split.id}:separator:${index}`
    context.parts.push({ key, kind: 'separator', box: { ...separator, z: context.backZ, d: depth - context.backZ - context.frontInset } })
    context.dividers.push({ key, splitId: split.id, index, axis: split.axis, rect: separator })
    cursor += panelThickness
  })
}

const layoutNode = (context: Context, node: FurnitureNode, rect: Rect) =>
  node.type === 'split' ? layoutSplit(context, node, rect) : layoutLeaf(context, node, rect)

const carcassParts = (furniture: ParametricFurniture): Part[] => {
  const { width, height, depth, panelThickness: t, plinthHeight, hasBack } = furniture
  const innerWidth = width - t * 2
  const parts: Part[] = [
    { key: 'side:left', kind: 'carcass', box: { x: 0, y: 0, z: 0, w: t, h: height, d: depth } },
    { key: 'side:right', kind: 'carcass', box: { x: width - t, y: 0, z: 0, w: t, h: height, d: depth } },
    { key: 'top', kind: 'carcass', box: { x: t, y: height - t, z: 0, w: innerWidth, h: t, d: depth } },
    { key: 'bottom', kind: 'carcass', box: { x: t, y: plinthHeight, z: 0, w: innerWidth, h: t, d: depth } },
  ]
  if (plinthHeight > 0) {
    parts.push({ key: 'plinth', kind: 'plinth', box: { x: t, y: 0, z: depth - PLINTH_SETBACK - t, w: innerWidth, h: plinthHeight, d: t } })
  }
  if (hasBack) {
    const backHeight = height - plinthHeight - t * 2
    parts.push({ key: 'back', kind: 'back', box: { x: t, y: plinthHeight + t, z: 0, w: innerWidth, h: backHeight, d: BACK_THICKNESS } })
  }
  return parts
}

/** Panels sliding on two tracks in front of the compartments, overlapping a little where they meet. */
const addSlidingDoors = (context: Context, interior: Rect, count: number) => {
  const { depth, panelThickness: t, frontColor } = context.furniture
  const panelWidth = (interior.w + SLIDING_OVERLAP * (count - 1)) / count
  for (let index = 0; index < count; index++) {
    const z = index % 2 === 0 ? depth - t : depth - 2 * t - SLIDING_TRACK_GAP
    const x = interior.x + index * (panelWidth - SLIDING_OVERLAP)
    const key = `sliding:${index}`
    context.parts.push({ key, kind: 'sliding', color: frontColor, box: { x, y: interior.y, z, w: panelWidth, h: interior.h, d: t } })
    const isFirst = index === 0
    const isLast = index === count - 1
    addHandle(context, {
      key: `${key}:handle`,
      x: isFirst ? x + HANDLE_MARGIN : isLast ? x + panelWidth - HANDLE_MARGIN : x + panelWidth / 2,
      y: interior.y + interior.h / 2,
      z: z + t,
      length: Math.min(SLIDING_HANDLE_LENGTH, interior.h / 3),
      isVertical: true,
    })
  }
}

/** Turns the description of a piece of furniture into panels, compartments and draggable separators. */
export const computeLayout = (furniture: ParametricFurniture): Layout => {
  const { width, height, panelThickness: t, plinthHeight, hasBack, slidingDoors } = furniture
  const interior: Rect = { x: t, y: plinthHeight + t, w: Math.max(0, width - t * 2), h: Math.max(0, height - plinthHeight - t * 2) }
  const context: Context = {
    furniture,
    frontInset: slidingDoors ? 2 * t + SLIDING_TRACK_GAP * 2 : 0,
    backZ: hasBack ? BACK_THICKNESS : 0,
    parts: carcassParts(furniture),
    cells: [],
    dividers: [],
    splitLengths: {},
  }
  layoutNode(context, furniture.root, interior)
  if (slidingDoors) addSlidingDoors(context, interior, slidingDoors.count)
  const { parts, cells, dividers, splitLengths, backZ } = context
  return { parts, cells, dividers, splitLengths, interior, backZ }
}
