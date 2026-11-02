/**
 * The page behind a share link.
 *
 * This exists because crawlers do not run JavaScript. MaestroTrack is a
 * Vite SPA behind a catch-all rewrite to index.html, so every URL returns
 * the same empty shell — paste one into WhatsApp and you get a grey box
 * with the generic site title. The Open Graph tags have to be in the HTML
 * that comes back from the server, which means this has to be a function
 * and not a route in the app.
 *
 * It reads the share document straight from Firestore's REST API. No SDK
 * and no credentials: `get` on /shares is open by design, because the
 * thing fetching it is a crawler, signed in as nobody.
 */

const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID
const API_KEY = process.env.VITE_FIREBASE_API_KEY

/**
 * Everything interpolated below came from a user — a display name, a
 * piece title — and is going into a public HTML page. Escaped on the way
 * out, every time, with no exceptions for "this one is a number".
 */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Firestore REST returns every value wrapped in its type. Unwrap it. */
function plain(value) {
  if (!value || typeof value !== 'object') return undefined
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('booleanValue' in value) return value.booleanValue
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(plain)
  if ('mapValue' in value) {
    const out = {}
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) out[k] = plain(v)
    return out
  }
  return undefined
}

function page({ title, description, image, body, status }) {
  return { status, html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<!-- Not search results. A share link is for the person it was sent to. -->
<meta name="robots" content="noindex,nofollow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MaestroTrack">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root { --bg:#F1ECF8; --surface:#FFF; --ink:#3A3054; --dim:#8B82A3; --accent:#FF7A5C; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
         padding:24px; background:var(--bg); color:var(--ink);
         font-family:Fredoka,system-ui,sans-serif; }
  main { width:100%; max-width:540px; text-align:center; }
  .card { background:var(--surface); border-radius:16px; padding:8px;
          box-shadow:0 6px 16px -6px rgba(58,48,84,.22); overflow:hidden; }
  .card img { display:block; width:100%; height:auto; border-radius:10px; }
  h1 { margin:24px 0 6px; font-size:22px; font-weight:600; }
  p { margin:0; color:var(--dim); font-size:15px; }
  .mark { margin-top:28px; font-size:13px; color:var(--dim); }
  .mark b { color:var(--accent); font-weight:600; }
</style>
</head>
<body>
<main>
${body}
<p class="mark">Tracked with <b>MaestroTrack</b></p>
</main>
</body>
</html>` }
}

function notFound() {
  return page({
    status: 404,
    title: 'This link has expired — MaestroTrack',
    description: 'The person who shared this has since taken it down.',
    body: `<h1>This link is no longer available</h1>
<p>The person who shared it has taken it down.</p>`,
  })
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug ?? '').trim()

  // The slug shape is fixed by newSlug(): 22 url-safe characters. Checking
  // it here keeps anything else from reaching the Firestore URL at all.
  if (!/^[A-Za-z0-9]{22}$/.test(slug) || !PROJECT || !API_KEY) {
    const out = notFound()
    res.status(out.status).setHeader('content-type', 'text/html; charset=utf-8')
    return res.send(out.html)
  }

  let doc
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}`
      + `/databases/(default)/documents/shares/${slug}?key=${API_KEY}`
    const response = await fetch(url)
    if (response.ok) doc = await response.json()
  } catch {
    // Treated as missing: a share page that cannot read its share has
    // nothing to say, and saying it badly is worse than saying it is gone.
  }

  if (!doc?.fields) {
    const out = notFound()
    res.status(out.status).setHeader('content-type', 'text/html; charset=utf-8')
    return res.send(out.html)
  }

  const fields = plain(doc.fields.fields) ?? {}
  const image = plain(doc.fields.image)
  const name = fields.name
  const minutes = Number(fields.minutes ?? 0)

  const who = name ? `${name} ` : ''
  const title = fields.badgeLabel
    ? `${who}earned ${fields.badgeLabel}`
    : `${who}practised ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`

  const parts = []
  if (fields.pieceTitle) parts.push(fields.pieceTitle)
  if (fields.streakDays) parts.push(`${fields.streakDays}-day streak`)
  if (fields.dateLabel) parts.push(fields.dateLabel)
  const description = parts.join(' · ') || 'Practice, tracked.'

  const out = page({
    status: 200,
    title: `${title} — MaestroTrack`,
    description,
    image,
    body: `${image ? `<div class="card"><img src="${esc(image)}" alt="${esc(title)}"></div>` : ''}
<h1>${esc(title)}</h1>
<p>${esc(description)}</p>`,
  })

  res
    .status(out.status)
    .setHeader('content-type', 'text/html; charset=utf-8')
    // A published share never changes — update is denied in the rules —
    // so this is safe to cache hard, which is what keeps a link that gets
    // passed around from hitting Firestore once per crawler.
    .setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  return res.send(out.html)
}
