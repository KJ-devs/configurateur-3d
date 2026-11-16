const MM_PER_M = 1000
const MM_PER_CM = 10

/** Data is stored in millimetres, the 3D scene works in metres. */
export const mmToM = (mm: number): number => mm / MM_PER_M

export const mToMm = (m: number): number => Math.round(m * MM_PER_M)

/** 1250 → "125 cm", 1255 → "125,5 cm" */
export const formatCm = (mm: number): string => {
  const cm = Math.round(mm) / MM_PER_CM
  return `${cm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} cm`
}

/** "L × H × P" in centimetres, the way furniture is usually labelled. */
export const formatDimensions = (width: number, height: number, depth: number): string =>
  `${[width, height, depth].map((mm) => (Math.round(mm) / MM_PER_CM).toLocaleString('fr-FR')).join(' × ')} cm`

export const formatPrice = (euros: number): string =>
  euros.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
