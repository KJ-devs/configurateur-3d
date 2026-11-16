import { create } from 'zustand'

/** Reversible change. The same history serves the room planner and the furniture builder. */
export type Command = { label: string; undo: () => void; redo: () => void }

export type HistoryStacks = { past: Command[]; future: Command[] }

export const HISTORY_LIMIT = 100

/** Adds a command whose effect is already applied. Any redo branch is dropped. */
export const recordCommand = (stacks: HistoryStacks, command: Command): HistoryStacks => ({
  past: [...stacks.past, command].slice(-HISTORY_LIMIT),
  future: [],
})

export const undoCommand = (stacks: HistoryStacks): HistoryStacks => {
  const command = stacks.past.at(-1)
  if (!command) return stacks

  command.undo()
  return { past: stacks.past.slice(0, -1), future: [command, ...stacks.future] }
}

export const redoCommand = (stacks: HistoryStacks): HistoryStacks => {
  const [command, ...future] = stacks.future
  if (!command) return stacks

  command.redo()
  return { past: [...stacks.past, command], future }
}

type HistoryStore = HistoryStacks & {
  /** Runs the command, then records it. */
  execute: (command: Command) => void
  /** Records a command that was already applied (for instance at the end of a drag). */
  record: (command: Command) => void
  undo: () => void
  redo: () => void
  clear: () => void
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  execute: (command) => {
    command.redo()
    set(recordCommand(get(), command))
  },
  record: (command) => set(recordCommand(get(), command)),
  undo: () => set(undoCommand(get())),
  redo: () => set(redoCommand(get())),
  clear: () => set({ past: [], future: [] }),
}))
