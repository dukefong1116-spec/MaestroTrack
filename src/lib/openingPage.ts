/**
 * The page being opened, handed from App.tsx (which starts loading it) to
 * main.tsx (which waits, briefly, for it before the first draw).
 */
let ready: Promise<unknown> = Promise.resolve()

export function setOpeningPage(p: Promise<unknown>) {
  ready = p
}

export function openingPageReady(): Promise<unknown> {
  return ready
}
