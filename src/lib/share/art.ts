import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

/**
 * A piece of the app's own SVG artwork (Femata, a badge), as an image a
 * canvas can draw.
 *
 * Rendered once into a detached node, serialised, and loaded back from a
 * data URL — so the card shows exactly the drawing the app shows, sharp
 * at any size, with nothing fetched from anywhere (a remote image would
 * taint the canvas and stop it being saved).
 *
 * Returns null if anything goes wrong: a card without its artwork is
 * still a card, and sharing must never fail for the sake of a picture.
 */
export async function rasterize(node: ReactElement): Promise<HTMLImageElement | null> {
  try {
    // Out of React's own render first: this is called from an effect, and
    // a second root cannot be flushed while the first is mid-update.
    await new Promise((r) => setTimeout(r, 0))
    const host = document.createElement('div')
    const root = createRoot(host)
    flushSync(() => root.render(node))
    const svg = host.querySelector('svg')
    const markup = svg ? new XMLSerializer().serializeToString(svg.getAttribute('xmlns') ? svg : (svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'), svg)) : ''
    setTimeout(() => root.unmount(), 0)
    if (!markup) return null
    const img = new Image()
    img.decoding = 'async'
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
    await img.decode()
    return img
  } catch {
    return null
  }
}
