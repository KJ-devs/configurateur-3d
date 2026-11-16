import { usePlannerStore } from '../../../store/plannerStore'
import { FloorLine } from './FloorLine'

const GUIDE_COLOR = '#d946ef'
const GUIDE_OVERSHOOT = 150

/** Alignment lines shown while a furniture snaps to the edges of another one. */
export const SnapGuides = () => {
  const guides = usePlannerStore((state) => state.guides)

  return guides.map((guide) => {
    const from = guide.from - GUIDE_OVERSHOOT
    const to = guide.to + GUIDE_OVERSHOOT
    const [start, end] =
      guide.axis === 'x'
        ? [{ x: guide.value, z: from }, { x: guide.value, z: to }]
        : [{ x: from, z: guide.value }, { x: to, z: guide.value }]
    return <FloorLine key={`${guide.axis}-${guide.value}`} from={start} to={end} color={GUIDE_COLOR} elevation={0.02} />
  })
}
