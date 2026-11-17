import * as z from 'zod'

export type Axis = 'x' | 'y'
export type Hinge = 'left' | 'right'

export type HandleStyle = 'bar' | 'knob' | 'none'

/** Shelves hidden behind doors are optional: older documents have none. */
export type Content =
  | { kind: 'empty' }
  | { kind: 'shelf'; count: number }
  | { kind: 'door'; hinge: Hinge; shelves?: number }
  | { kind: 'glassDoor'; hinge: Hinge; shelves?: number }
  | { kind: 'doubleDoor'; shelves?: number }
  | { kind: 'flap' }
  | { kind: 'drawer'; count: number }
  | { kind: 'rail' }

export type ContentKind = Content['kind']

export type Size = { mode: 'fixed'; mm: number } | { mode: 'flex'; weight: number }

/** `color` paints the compartment: its fronts, shelves and the back of the niche. */
export type LeafNode = { id: string; type: 'leaf'; content: Content; color?: string }
export type SplitNode = { id: string; type: 'split'; axis: Axis; sizes: Size[]; children: FurnitureNode[] }
export type FurnitureNode = LeafNode | SplitNode

export type ParametricFurniture = {
  schemaVersion: 1
  width: number
  height: number
  depth: number
  panelThickness: number
  materialId: string
  hasBack: boolean
  plinthHeight: number
  root: FurnitureNode
  /** Colour of the carcass, instead of the material's own. */
  color?: string
  /** Colour of every door and drawer front, unless a compartment has its own. */
  frontColor?: string
  handle?: HandleStyle
  /** Sliding panels covering the whole front. */
  slidingDoors?: { count: number }
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const hinge = z.enum(['left', 'right'])
const innerShelves = z.number().int().min(0).optional()

const contentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('empty') }),
  z.object({ kind: z.literal('shelf'), count: z.number().int().min(0) }),
  z.object({ kind: z.literal('door'), hinge, shelves: innerShelves }),
  z.object({ kind: z.literal('glassDoor'), hinge, shelves: innerShelves }),
  z.object({ kind: z.literal('doubleDoor'), shelves: innerShelves }),
  z.object({ kind: z.literal('flap') }),
  z.object({ kind: z.literal('drawer'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('rail') }),
])

const sizeSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), mm: z.number().min(0) }),
  z.object({ mode: z.literal('flex'), weight: z.number().positive() }),
])

const nodeSchema: z.ZodType<FurnitureNode> = z.lazy(() =>
  z.union([
    z.object({ id: z.string(), type: z.literal('leaf'), content: contentSchema, color: hexColor.optional() }),
    z
      .object({
        id: z.string(),
        type: z.literal('split'),
        axis: z.enum(['x', 'y']),
        sizes: z.array(sizeSchema),
        children: z.array(nodeSchema).min(1),
      })
      .refine((split) => split.sizes.length === split.children.length, 'sizes and children must have the same length'),
  ]),
)

const furnitureSchema = z.object({
  schemaVersion: z.literal(1),
  width: z.number().positive(),
  height: z.number().positive(),
  depth: z.number().positive(),
  panelThickness: z.number().positive(),
  materialId: z.string(),
  hasBack: z.boolean(),
  plinthHeight: z.number().min(0),
  root: nodeSchema,
  color: hexColor.optional(),
  frontColor: hexColor.optional(),
  handle: z.enum(['bar', 'knob', 'none']).optional(),
  slidingDoors: z.object({ count: z.number().int().min(2).max(4) }).optional(),
})

const parsed = new WeakMap<object, ParametricFurniture | null>()

/** Returns null when the JSON is not a valid ParametricFurniture document. Results are cached per object. */
export const parseFurniture = (json: unknown): ParametricFurniture | null => {
  if (typeof json !== 'object' || json === null) return null
  const cached = parsed.get(json)
  if (cached !== undefined) return cached

  const result = furnitureSchema.safeParse(json)
  const furniture = result.success ? result.data : null
  parsed.set(json, furniture)
  return furniture
}
