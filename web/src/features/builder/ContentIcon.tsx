import type { ContentKind } from '../../engine/schema'

const STROKE = 'currentColor'

/** Front-view pictogram of a compartment content. */
export const ContentIcon = ({ kind }: { kind: ContentKind }) => (
  <svg viewBox="0 0 28 36" width={28} height={36} fill="none" stroke={STROKE} strokeWidth={1.5} aria-hidden>
    <rect x={1} y={1} width={26} height={34} rx={1.5} />
    {kind === 'shelf' && (
      <>
        <line x1={1} y1={12.5} x2={27} y2={12.5} />
        <line x1={1} y1={23.5} x2={27} y2={23.5} />
      </>
    )}
    {kind === 'door' && <line x1={21} y1={14} x2={21} y2={22} strokeWidth={2} strokeLinecap="round" />}
    {kind === 'glassDoor' && (
      <>
        <rect x={4.5} y={4.5} width={19} height={27} rx={0.5} strokeWidth={1} />
        <path d="M8 14l6-6M8 21l11-11" strokeWidth={1} strokeLinecap="round" />
        <line x1={21} y1={15} x2={21} y2={21} strokeWidth={2} strokeLinecap="round" />
      </>
    )}
    {kind === 'flap' && (
      <>
        <line x1={10} y1={6} x2={18} y2={6} strokeWidth={2} strokeLinecap="round" />
        <path d="M5 30h18" strokeWidth={1} strokeDasharray="2 2" />
      </>
    )}
    {kind === 'doubleDoor' && (
      <>
        <line x1={14} y1={1} x2={14} y2={35} />
        <line x1={10.5} y1={15} x2={10.5} y2={21} strokeWidth={2} strokeLinecap="round" />
        <line x1={17.5} y1={15} x2={17.5} y2={21} strokeWidth={2} strokeLinecap="round" />
      </>
    )}
    {kind === 'drawer' && (
      <>
        <line x1={1} y1={12.5} x2={27} y2={12.5} />
        <line x1={1} y1={23.5} x2={27} y2={23.5} />
        {[7, 18, 29].map((y) => (
          <line key={y} x1={11} y1={y} x2={17} y2={y} strokeWidth={2} strokeLinecap="round" />
        ))}
      </>
    )}
    {kind === 'rail' && (
      <>
        <line x1={3} y1={7} x2={25} y2={7} strokeWidth={2} strokeLinecap="round" />
        <path d="M9 7v3l-4 5h8l-4-5M19 7v3l-4 5h8l-4-5" strokeWidth={1.2} strokeLinejoin="round" />
      </>
    )}
  </svg>
)
