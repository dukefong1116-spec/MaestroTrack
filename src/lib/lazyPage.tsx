import { lazy, type ComponentType } from 'react'

/**
 * A page loaded on demand that, once its code is here, draws directly.
 *
 * React.lazy always suspends the first time it renders, even when the file
 * has already arrived — and React then holds the real page back for up to
 * 300 ms after showing the spinner, so a reveal never flickers. Measured on
 * a slow phone, that pause was most of the wait before Today appeared.
 * Pages fetched ahead (the one being opened, the tabs after it) skip the
 * spinner and the pause entirely; the rest behave as before.
 */
export function lazyPage<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  let mod: { default: ComponentType<P> } | null = null
  let pending: Promise<{ default: ComponentType<P> }> | null = null
  const fetch = () => {
    pending ??= load()
      .then((m) => { mod = m; return m })
      .catch((e) => { pending = null; throw e })
    return pending
  }
  const Lazy = lazy(fetch)
  function Page(props: P) {
    const Loaded = mod?.default
    return Loaded ? <Loaded {...props} /> : <Lazy {...props} />
  }
  return { Page, load: fetch }
}
