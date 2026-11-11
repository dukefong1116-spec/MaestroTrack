import { describe, expect, it, vi } from 'vitest'

/** Firestore's fake: hands back whatever the listener was given. */
let listener: (snap: unknown) => void
vi.mock('firebase/firestore', () => ({
  onSnapshot: (_t: unknown, _o: unknown, next: (s: unknown) => void) => { listener = next; return () => {} },
}))
const { onServerSnapshot } = await import('../snapshotError')

const list = (fromCache: boolean, changes: number, id = 'x') => ({ id, metadata: { fromCache }, docChanges: () => Array(changes).fill(0) })
const doc = (fromCache: boolean, data: unknown) => ({ metadata: { fromCache }, data: () => data })

describe('listening only once the server has spoken', () => {
  it("ignores the empty answer Firestore gives from memory with no connection", () => {
    const next = vi.fn()
    onServerSnapshot({} as never, next)
    listener(list(true, 0))
    listener(list(true, 3))
    expect(next).not.toHaveBeenCalled()
  })
  it('delivers the first server answer, even with nothing changed since memory', () => {
    const next = vi.fn()
    onServerSnapshot({} as never, next)
    listener(list(true, 0))
    listener(list(false, 0))
    expect(next).toHaveBeenCalledTimes(1)
  })
  it('after that: real changes yes (your own writes included), metadata alone no', () => {
    const next = vi.fn()
    onServerSnapshot({} as never, next)
    listener(list(false, 2))
    listener(list(true, 1))
    listener(list(false, 0))
    expect(next).toHaveBeenCalledTimes(2)
  })
  it('a single document likewise, delivered only when it differs', () => {
    const next = vi.fn()
    onServerSnapshot({} as never, next)
    listener(doc(true, undefined))
    expect(next).not.toHaveBeenCalled()
    listener(doc(false, { a: 1 }))
    listener(doc(false, { a: 1 }))
    listener(doc(false, { a: 2 }))
    expect(next).toHaveBeenCalledTimes(2)
  })
})
