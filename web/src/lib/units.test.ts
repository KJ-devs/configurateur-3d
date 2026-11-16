import { describe, expect, it } from 'vitest'
import { formatCm, formatDimensions, mmToM, mToMm } from './units'

describe('units', () => {
  it('converts millimetres to metres and back', () => {
    expect(mmToM(2500)).toBe(2.5)
    expect(mToMm(0.018)).toBe(18)
    expect(mToMm(mmToM(1234))).toBe(1234)
  })

  it('formats a length in centimetres', () => {
    expect(formatCm(1250)).toBe('125 cm')
    expect(formatCm(1255)).toBe('125,5 cm')
  })

  it('formats furniture dimensions as width × height × depth', () => {
    expect(formatDimensions(800, 2000, 300)).toBe('80 × 200 × 30 cm')
  })
})
