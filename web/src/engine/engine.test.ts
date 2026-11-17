import { describe, expect, it } from 'vitest'
import { estimatePrice, findIssues } from './analysis'
import { computeLayout, resolveSizes } from './layout'
import { parseFurniture, type FurnitureNode, type ParametricFurniture } from './schema'
import { TEMPLATES } from './templates'
import { setCellColor, setOption, mergeCell, moveDivider, setChildAuto, setChildLength, sizeSlot, splitCell } from './tree'

const T = 18

const furnitureWith = (root: FurnitureNode, overrides: Partial<ParametricFurniture> = {}): ParametricFurniture => ({
  schemaVersion: 1,
  width: 1000,
  height: 2000,
  depth: 400,
  panelThickness: T,
  materialId: 'oak',
  hasBack: true,
  plinthHeight: 0,
  root,
  ...overrides,
})

const twoColumns = (): ParametricFurniture =>
  furnitureWith({
    id: 'root',
    type: 'split',
    axis: 'x',
    sizes: [{ mode: 'flex', weight: 1 }, { mode: 'flex', weight: 1 }],
    children: [
      { id: 'a', type: 'leaf', content: { kind: 'shelf', count: 2 } },
      { id: 'b', type: 'leaf', content: { kind: 'door', hinge: 'left' } },
    ],
  })

const cellWidth = (furniture: ParametricFurniture, id: string): number =>
  computeLayout(furniture).cells.find((cell) => cell.id === id)?.rect.w ?? Number.NaN

describe('resolveSizes', () => {
  it('shares the space left by fixed sizes and separators between flex sizes', () => {
    const sizes = resolveSizes([{ mode: 'fixed', mm: 400 }, { mode: 'flex', weight: 1 }, { mode: 'flex', weight: 3 }], 1236, 18)
    expect(sizes).toEqual([400, 200, 600])
  })

  it('scales fixed sizes when they do not fit', () => {
    expect(resolveSizes([{ mode: 'fixed', mm: 600 }, { mode: 'fixed', mm: 600 }], 618, 18)).toEqual([300, 300])
  })
})

describe('computeLayout', () => {
  it('fills the interior with compartments and separators', () => {
    const layout = computeLayout(twoColumns())
    const [left, right] = layout.cells

    expect(layout.interior).toEqual({ x: T, y: T, w: 1000 - 2 * T, h: 2000 - 2 * T })
    expect(left.rect.w + right.rect.w + T).toBe(layout.interior.w)
    expect(right.rect.x).toBe(left.rect.x + left.rect.w + T)
    expect(layout.dividers).toHaveLength(1)
    expect(layout.parts.filter((part) => part.kind === 'shelf')).toHaveLength(2)
    expect(layout.parts.filter((part) => part.kind === 'door')).toHaveLength(1)
  })

  it('raises the interior above the plinth', () => {
    const layout = computeLayout(furnitureWith({ id: 'root', type: 'leaf', content: { kind: 'empty' } }, { plinthHeight: 100 }))
    expect(layout.interior.y).toBe(100 + T)
    expect(layout.parts.some((part) => part.kind === 'plinth')).toBe(true)
  })
})

describe('tree editing', () => {
  it('adds a sibling when splitting along the axis of the parent', () => {
    const { furniture, newCellId } = splitCell(twoColumns(), computeLayout(twoColumns()), 'a', 'x')
    expect(furniture.root.type === 'split' && furniture.root.children.map((child) => child.id)).toEqual(['a', newCellId, 'b'])
    expect(cellWidth(furniture, 'b')).toBeCloseTo(cellWidth(twoColumns(), 'b'))
  })

  it('nests a split when cutting across the parent', () => {
    const { furniture } = splitCell(twoColumns(), computeLayout(twoColumns()), 'a', 'y')
    const root = furniture.root
    expect(root.type === 'split' && root.children[0].type).toBe('split')
  })

  it('merges a compartment into its neighbour and collapses a lone child', () => {
    const initial = twoColumns()
    const result = mergeCell(initial, computeLayout(initial), 'b')
    expect(result?.keptId).toBe('a')
    expect(result?.furniture.root).toEqual({ id: 'a', type: 'leaf', content: { kind: 'shelf', count: 2 } })
  })

  it('moves a divider without changing the other compartments', () => {
    const initial = splitCell(twoColumns(), computeLayout(twoColumns()), 'b', 'x').furniture
    const layout = computeLayout(initial)
    const moved = moveDivider(initial, layout, layout.dividers[0], 50)
    const after = computeLayout(moved)

    expect(after.cells[0].rect.w).toBeCloseTo(layout.cells[0].rect.w + 50)
    expect(after.cells[1].rect.w).toBeCloseTo(layout.cells[1].rect.w - 50)
    expect(after.cells[2].rect.w).toBeCloseTo(layout.cells[2].rect.w)
  })

  it('sets an exact width, then gives it back to the flexible sizing', () => {
    const initial = twoColumns()
    const slot = sizeSlot(initial, 'a', 'x')
    if (!slot) throw new Error('missing slot')

    const fixed = setChildLength(initial, computeLayout(initial), slot, 300)
    expect(cellWidth(fixed, 'a')).toBe(300)
    expect(cellWidth({ ...fixed, width: 1200 }, 'a')).toBe(300)

    const fixedSlot = sizeSlot(fixed, 'a', 'x')
    if (!fixedSlot) throw new Error('missing slot')
    const auto = setChildAuto(fixed, computeLayout(fixed), fixedSlot)
    expect(cellWidth(auto, 'a')).toBeCloseTo(300)
    expect(cellWidth({ ...auto, width: 1200 }, 'a')).toBeGreaterThan(300)
  })
})

describe('analysis', () => {
  it('prices panels and hardware', () => {
    const furniture = twoColumns()
    const { price, panelArea } = estimatePrice(computeLayout(furniture), 100)
    expect(panelArea).toBeGreaterThan(2)
    expect(price).toBeGreaterThan(panelArea * 100)
  })

  it('warns about a wide single door', () => {
    const furniture = furnitureWith({ id: 'root', type: 'leaf', content: { kind: 'door', hinge: 'left' } })
    expect(findIssues(furniture, computeLayout(furniture))).toHaveLength(1)
  })
})

describe('customisation', () => {
  const kinds = (furniture: ParametricFurniture) => computeLayout(furniture).parts.map((part) => part.kind)

  it('adds sliding panels and pushes the compartment fronts behind their tracks', () => {
    const plain = furnitureWith({ id: 'root', type: 'leaf', content: { kind: 'drawer', count: 2 } })
    const sliding = setOption(plain, 'slidingDoors', { count: 3 })
    const drawerZ = (furniture: ParametricFurniture) => computeLayout(furniture).parts.find((part) => part.kind === 'drawer')?.box.z ?? 0

    expect(kinds(sliding).filter((kind) => kind === 'sliding')).toHaveLength(3)
    expect(drawerZ(sliding)).toBeLessThan(drawerZ(plain) - 2 * T)
  })

  it('warns when a hinged door sits behind sliding doors', () => {
    const furniture = furnitureWith({ id: 'root', type: 'leaf', content: { kind: 'flap' } }, { slidingDoors: { count: 2 } })
    expect(findIssues(furniture, computeLayout(furniture))).toHaveLength(1)
  })

  it('paints a single compartment and the fronts of the others', () => {
    const furniture = setOption(setCellColor(twoColumns(), 'a', '#2c3e5c'), 'frontColor', '#d9a84e')
    const parts = computeLayout(furniture).parts
    expect(parts.filter((part) => part.cellId === 'a' && part.kind !== 'handle').every((part) => part.color === '#2c3e5c')).toBe(true)
    expect(parts.some((part) => part.kind === 'liner' && part.cellId === 'a')).toBe(true)
    expect(parts.find((part) => part.kind === 'door')?.color).toBe('#d9a84e')
    expect(parts.find((part) => part.kind === 'carcass')?.color).toBeUndefined()
  })

  it('removes handles for push-to-open fronts and keeps inner shelves behind doors', () => {
    const furniture = furnitureWith({ id: 'root', type: 'leaf', content: { kind: 'glassDoor', hinge: 'left', shelves: 3 } }, { handle: 'none' })
    expect(kinds(furniture)).not.toContain('handle')
    expect(kinds(furniture).filter((kind) => kind === 'shelf')).toHaveLength(3)
    expect(kinds(furniture)).toContain('glass')
  })
})

describe('templates', () => {
  it.each(TEMPLATES.map((template) => [template.name, template]))('%s is a valid piece without advice', (_name, template) => {
    const furniture = template.build('oak', T)
    expect(parseFurniture(JSON.parse(JSON.stringify(furniture)))).toEqual(furniture)
    expect(findIssues(furniture, computeLayout(furniture))).toEqual([])
  })
})

describe('parseFurniture', () => {
  it('accepts a valid document and rejects a broken one', () => {
    const furniture = twoColumns()
    expect(parseFurniture(JSON.parse(JSON.stringify(furniture)))).toEqual(furniture)
    expect(parseFurniture({ ...furniture, root: { id: 'x', type: 'split', axis: 'x', sizes: [], children: [] } })).toBeNull()
  })
})
