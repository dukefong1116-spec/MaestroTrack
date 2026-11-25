/**
 * The page behind a share link.
 *
 * This exists because crawlers do not run JavaScript. Femata is a
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
const BUCKET = process.env.VITE_FIREBASE_STORAGE_BUCKET

/**
 * The preview picture is only ever this project's own, from the owner's
 * own share folder — the same check the Firestore rules make, repeated
 * here so a share written before the rule was tightened cannot put
 * somebody else's picture on this domain.
 */
function ownImage(image, ownerId) {
  if (typeof image !== 'string' || !BUCKET || typeof ownerId !== 'string') return undefined
  const prefix = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/shares%2F${encodeURIComponent(ownerId)}%2F`
  return image.startsWith(prefix) && image.length < 1000 ? image : undefined
}

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

function page({ title, description, image, body, status, css = '', bare = false }) {
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
<meta property="og:site_name" content="Femata">
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
  /* "Try Femata": pinned to the bottom of every share page. */
  .try { position:fixed; z-index:5; left:50%; transform:translateX(-50%);
         bottom:max(14px, env(safe-area-inset-bottom)); width:min(92vw, 540px);
         display:flex; align-items:center; gap:12px; padding:10px 10px 10px 18px;
         border-radius:18px; background:#fff; color:#0E1626; text-decoration:none;
         box-shadow:0 12px 32px rgba(0,0,0,.3); }
  .try span { flex:1; font-size:15px; font-weight:600; line-height:1.25; text-align:left; }
  .try b { background:#3DB5F5; color:#04223A; border-radius:999px; padding:9px 15px;
           font-size:14px; font-weight:600; white-space:nowrap; }
${css}
</style>
</head>
<body${bare ? ' class="bare"' : ''}>
${bare ? body : `<main>
${body}
<p class="mark">Tracked with <b>Femata</b></p>
</main>`}
<a class="try" href="https://femataus.com"><span>🎵 Practise with Femata. It makes practice fun.</span><b>Try it free</b></a>
</body>
</html>` }
}

function notFound() {
  return page({
    status: 404,
    title: 'This link has expired — Femata',
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
  const image = ownImage(plain(doc.fields.image), plain(doc.fields.ownerId))
  const name = fields.name
  const minutes = Number(fields.minutes ?? 0)

  const who = name ? `${name} ` : ''
  const title = fields.badgeLabel
    ? `${who}earned ${fields.badgeLabel}`
    : fields.headline
      ? `${name ? `${name}: ` : ''}${fields.headline}`
      : fields.streakDays && !minutes
        ? `${who}is on a ${fields.streakDays}-day practice streak`
        : `${who}practised ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`

  const parts = []
  if (fields.subline) parts.push(fields.subline)
  if (fields.pieceTitle) parts.push(fields.pieceTitle)
  if (fields.streakDays) parts.push(`${fields.streakDays}-day streak`)
  if (fields.dateLabel) parts.push(fields.dateLabel)
  const description = parts.join(' · ') || 'Practice, tracked.'

  const owner = plain(doc.fields.ownerId)
  const out = req.query?.view === 'profile'
    ? await profilePage(owner, slug, name)
    : await cardPage({ owner, slug, title, description, image, name })

  res
    .status(out.status)
    .setHeader('content-type', 'text/html; charset=utf-8')
    // A published share never changes — update is denied in the rules —
    // so this is safe to cache hard, which is what keeps a link that gets
    // passed around from hitting Firestore once per crawler.
    .setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  return res.send(out.html)
}

/* ── The card, full screen ─────────────────────────────────────────── */

/** A file in this project's public share folder, by path (readable by anyone). */
const publicFile = (path) => BUCKET
  ? `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`
  : undefined

const CARD_CSS = `
  body.bare { display:block; padding:0; height:100dvh; overflow:hidden; background:#0B111E; }
  .blur { position:fixed; inset:-40px; background-size:cover; background-position:center;
          filter:blur(36px) brightness(.55); }
  .art { position:fixed; inset:0; width:100%; height:100%; object-fit:contain; }
  .x { position:fixed; z-index:5; top:max(14px, env(safe-area-inset-top)); left:14px;
       width:42px; height:42px; border-radius:50%; display:flex; align-items:center;
       justify-content:center; background:rgba(0,0,0,.45); color:#fff; font-size:22px;
       text-decoration:none; -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); }
  .none { position:fixed; inset:0; display:flex; flex-direction:column; align-items:center;
          justify-content:center; padding:24px; color:#fff; text-align:center; }
  .none p { color:#9AA8C0; }`

async function cardPage({ owner, slug, title, description, image, name }) {
  // The tall card for a phone, the wide one for a computer; whichever exists.
  let tall
  const tallUrl = typeof owner === 'string' ? publicFile(`shares/${owner}/${slug}-full.png`) : undefined
  if (tallUrl) {
    try { if ((await fetch(tallUrl, { method: 'HEAD' })).ok) tall = tallUrl } catch { /* the wide one will do */ }
  }
  const main = tall ?? image
  const body = main
    ? `<div class="blur" style="background-image:url('${esc(main)}')"></div>
<picture>${tall && image ? `<source media="(min-aspect-ratio: 1/1)" srcset="${esc(image)}">` : ''}<img class="art" src="${esc(main)}" alt="${esc(title)}"></picture>`
    : `<div class="none"><h1>${esc(title)}</h1><p>${esc(description)}</p></div>`
  return page({
    status: 200, title: `${title} — Femata`, description, image, css: CARD_CSS, bare: true,
    body: `${body}
<a class="x" href="/s/${esc(slug)}/profile" aria-label="${esc(name ? `See ${name}'s profile` : 'See their profile')}">✕</a>`,
  })
}

/* ── The sharer's profile: what the league shows of them ───────────── */

const TIERS = ['Pianissimo', 'Piano', 'Forte', 'Fortissimo']
const cap = (s) => (typeof s === 'string' && s ? s[0].toUpperCase() + s.slice(1).replace(/[-_]/g, ' ') : '')

const PROFILE_CSS = `
  body.bare { display:block; padding:0 0 110px; background:#F5F7FB; }
  .pf { max-width:560px; margin:0 auto; }
  .ban { height:170px; background:linear-gradient(135deg,#8F86E6,#3C3489) center/cover; }
  .back { position:absolute; top:max(14px, env(safe-area-inset-top)); left:14px; width:42px; height:42px;
          border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.4);
          color:#fff; font-size:22px; text-decoration:none; }
  .who { padding:0 20px; text-align:left; }
  .av { width:96px; height:96px; margin-top:-48px; border-radius:50%; border:4px solid #F5F7FB; object-fit:cover;
        display:flex; align-items:center; justify-content:center; font-size:36px; font-weight:600; color:#fff; }
  .who h1 { margin:10px 0 2px; font-size:26px; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; padding:16px 20px; }
  .stat { background:#fff; border-radius:14px; padding:12px 6px; text-align:center; }
  .stat b { display:block; font-size:20px; color:#0E1626; }
  .stat span { font-size:12px; color:#6B7280; }
  h2 { margin:6px 20px 10px; font-size:14px; letter-spacing:.08em; color:#6B7280; text-align:left; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:0 20px; }
  .grid a { display:block; aspect-ratio:1200/630; border-radius:10px; overflow:hidden; background:#E5E7EB; }
  .grid img { width:100%; height:100%; object-fit:cover; display:block; }`

const COLOURS = ['#F2405C', '#3DB5F5', '#8F86E6', '#1D9E75', '#E8A33D', '#D4537E', '#6B7A99', '#1F8A96']

async function profilePage(owner, slug, fallbackName) {
  let card = null
  let shares = []
  if (typeof owner === 'string') {
    try {
      const { db } = await import('./_lib/admin.js')
      const store = db()
      const [c, s] = await Promise.all([
        store.doc(`leagueCards/${owner}`).get(),
        store.collection('shares').where('ownerId', '==', owner).orderBy('createdAt', 'desc').limit(9).get(),
      ])
      card = c.exists ? c.data() : null
      shares = s.docs.map((d) => ({ slug: d.id, image: ownImage(d.get('image'), owner) })).filter((x) => x.image)
    } catch {
      // Without the server's access the page still has the shared card's own name.
    }
  }
  const name = card?.name || fallbackName || 'A Femata musician'
  const banner = card?.bannerImage
    ? `background-image:url('${esc(card.bannerImage)}')`
    : card?.bannerColor ? `background:${esc(card.bannerColor)}` : ''
  const avatar = card?.photo
    ? `<img class="av" src="${esc(card.photo)}" alt="">`
    : `<div class="av" style="background:${COLOURS[(card?.colour ?? 0) % COLOURS.length]}">${esc(name.trim().charAt(0).toUpperCase())}</div>`
  const line = [cap(card?.instrument), cap(card?.level)].filter(Boolean).join(' · ')
  const stats = card ? `<div class="stats">
<div class="stat"><b>🔥 ${Number(card.streak ?? 0)}</b><span>day streak</span></div>
<div class="stat"><b>${esc(TIERS[card.tier] ?? '—')}</b><span>league</span></div>
<div class="stat"><b>${Array.isArray(card.badges) ? card.badges.length : 0}</b><span>badges</span></div>
<div class="stat"><b>${Number(card.topFinishes ?? 0)}</b><span>top finishes</span></div>
</div>` : ''
  const grid = shares.length ? `<h2>SHARED</h2><div class="grid">${shares.map((x) => `<a href="/s/${esc(x.slug)}"><img src="${esc(x.image)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''
  return page({
    status: 200, title: `${name} on Femata`, description: line || 'Practising with Femata.', css: PROFILE_CSS, bare: true,
    body: `<div class="pf"><div class="ban" style="${banner}"></div>
<a class="back" href="/s/${esc(slug)}" aria-label="Back to the card">‹</a>
<div class="who">${avatar}<h1>${esc(name)}</h1>${line ? `<p>${esc(line)}</p>` : ''}</div>
${stats}${grid}</div>`,
  })
}
