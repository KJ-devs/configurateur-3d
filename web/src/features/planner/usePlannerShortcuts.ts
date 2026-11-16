import { useEffect } from 'react'
import type { Point } from '../../planner/geometry'
import { useHistoryStore } from '../../store/history'
import { usePlannerStore } from '../../store/plannerStore'

const FALLBACK_NUDGE_STEP = 10
const QUARTER_TURN = 90

const ARROW_DIRECTIONS: Record<string, Point> = {
  ArrowLeft: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
  ArrowUp: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Returns true when the key was handled. */
const handleCommandKey = (key: string, isShift: boolean): boolean => {
  const history = useHistoryStore.getState()
  if (key === 'z' && !isShift) history.undo()
  else if (key === 'y' || (key === 'z' && isShift)) history.redo()
  else if (key === 'd') usePlannerStore.getState().duplicateSelected()
  else return false
  return true
}

const handlePlainKey = (event: KeyboardEvent): boolean => {
  const planner = usePlannerStore.getState()
  const direction = ARROW_DIRECTIONS[event.key]

  if (direction) {
    const step = planner.gridSize || FALLBACK_NUDGE_STEP
    planner.nudgeSelected({ x: direction.x * step, z: direction.z * step })
  } else if (event.key === 'Delete' || event.key === 'Backspace') planner.deleteSelected()
  else if (event.key === 'Escape') planner.clearSelection()
  else if (event.key.toLowerCase() === 'r') planner.rotateSelected(event.shiftKey ? -QUARTER_TURN : QUARTER_TURN)
  else return false
  return true
}

export const usePlannerShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return

      const isCommand = event.ctrlKey || event.metaKey
      const isHandled = isCommand ? handleCommandKey(event.key.toLowerCase(), event.shiftKey) : handlePlainKey(event)
      if (isHandled) event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
