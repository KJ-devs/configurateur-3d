import type { Axis, Content, FurnitureNode, ParametricFurniture, Size } from './schema'

export type Template = {
  key: string
  name: string
  description: string
  build: (materialId: string, panelThickness: number) => ParametricFurniture
}

const id = (): string => crypto.randomUUID()
const flex = (weight = 1): Size => ({ mode: 'flex', weight })
const fixed = (mm: number): Size => ({ mode: 'fixed', mm })
const leaf = (content: Content): FurnitureNode => ({ id: id(), type: 'leaf', content })
const split = (axis: Axis, sizes: Size[], children: FurnitureNode[]): FurnitureNode => ({ id: id(), type: 'split', axis, sizes, children })
const evenly = (axis: Axis, children: FurnitureNode[]): FurnitureNode => split(axis, children.map(() => flex()), children)

const shelves = (count: number) => leaf({ kind: 'shelf', count })
const drawers = (count: number) => leaf({ kind: 'drawer', count })
const door = (hinge: 'left' | 'right') => leaf({ kind: 'door', hinge })

type Shape = { width: number; height: number; depth: number; plinthHeight: number; root: () => FurnitureNode }

const template = (key: string, name: string, description: string, shape: Shape): Template => ({
  key,
  name,
  description,
  build: (materialId, panelThickness) => ({
    schemaVersion: 1,
    width: shape.width,
    height: shape.height,
    depth: shape.depth,
    panelThickness,
    materialId,
    hasBack: true,
    plinthHeight: shape.plinthHeight,
    root: shape.root(),
  }),
})

/** Starting points offered when a new piece of furniture is created. */
export const TEMPLATES: Template[] = [
  template('empty', 'Caisson vide', 'Partez de zéro', { width: 800, height: 1800, depth: 400, plinthHeight: 80, root: () => leaf({ kind: 'empty' }) }),
  template('bookcase', 'Bibliothèque', '2 colonnes d’étagères', {
    width: 1000, height: 2000, depth: 320, plinthHeight: 60,
    root: () => evenly('x', [shelves(4), shelves(4)]),
  }),
  template('chest', 'Commode', '4 tiroirs', { width: 900, height: 850, depth: 450, plinthHeight: 80, root: () => drawers(4) }),
  template('sideboard', 'Buffet', 'Portes et tiroirs', {
    width: 1600, height: 800, depth: 450, plinthHeight: 100,
    root: () => evenly('x', [door('left'), drawers(3), door('right')]),
  }),
  template('wardrobe', 'Dressing', 'Penderie, étagères et tiroirs', {
    width: 1200, height: 2200, depth: 600, plinthHeight: 80,
    root: () => evenly('x', [leaf({ kind: 'rail' }), split('y', [fixed(450), flex()], [drawers(2), shelves(4)])]),
  }),
  template('tv', 'Meuble TV', 'Bas, avec niche centrale', {
    width: 1800, height: 450, depth: 400, plinthHeight: 0,
    root: () => split('x', [flex(), flex(2), flex()], [drawers(1), shelves(1), drawers(1)]),
  }),
  template('column', 'Colonne', 'Haute et étroite, porte et tiroirs', {
    width: 500, height: 1900, depth: 400, plinthHeight: 80,
    root: () => split('y', [fixed(500), flex()], [drawers(2), door('right')]),
  }),
  template('cubes', 'Étagère cubes', '3 × 3 cases ouvertes', {
    width: 1200, height: 1200, depth: 330, plinthHeight: 0,
    root: () => evenly('y', [0, 1, 2].map(() => evenly('x', [0, 1, 2].map(() => leaf({ kind: 'empty' }))))),
  }),
]
