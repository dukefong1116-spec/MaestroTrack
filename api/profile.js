/**
 * The public profile behind a share link: who shared it, as the league
 * shows them — their name, photo, banner, instrument, level, the week,
 * streak, league and pinned badges — and the cards they have shared.
 *
 * Reached only through a share's slug, never by an id: a profile is seen
 * only by someone who was sent one of that person's links. Read on the
 * server, because a stranger has no access to anyone's profile or card;
 * what is returned is the same short list the league shows a roommate.
 * Never their email, studio, notes or practice history.
 */
import { db } from './_lib/admin.js'

const BUCKET = process.env.VITE_FIREBASE_STORAGE_BUCKET

/** Only this project's own share pictures, from the owner's own folder. */
function ownImage(image, ownerId) {
  if (typeof image !== 'string' || !BUCKET) return undefined
  const prefix = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/shares%2F${encodeURIComponent(ownerId)}%2F`
  return image.startsWith(prefix) && image.length < 1000 ? image : undefined
}

const str = (v) => (typeof v === 'string' && v ? v : null)

export default async function handler(req, res) {
  const slug = String(req.query?.slug ?? '').trim()
  res.setHeader('content-type', 'application/json; charset=utf-8')
  if (!/^[A-Za-z0-9]{22}$/.test(slug)) return res.status(404).send('{"error":"not found"}')
  try {
    const store = db()
    const share = await store.doc(`shares/${slug}`).get()
    const owner = share.exists ? share.get('ownerId') : null
    if (typeof owner !== 'string') return res.status(404).send('{"error":"not found"}')

    const [user, card, shares] = await Promise.all([
      store.doc(`users/${owner}`).get(),
      store.doc(`leagueCards/${owner}`).get(),
      store.collection('shares').where('ownerId', '==', owner).orderBy('createdAt', 'desc').limit(12).get(),
    ])
    const p = user.exists ? user.data() : {}
    const c = card.exists ? card.data() : {}
    const days = Array.isArray(c.days) && c.days.length === 7 ? c.days.map((n) => Number(n) || 0) : [0, 0, 0, 0, 0, 0, 0]

    const body = {
      card: {
        uid: '',
        roomId: '',
        name: str(p.displayName) ?? str(c.name) ?? 'Femata musician',
        colour: Number.isInteger(c.colour) ? c.colour : 0,
        instrument: str(p.instrument) ?? str(c.instrument),
        level: str(p.experienceLevel) ?? str(c.level),
        photo: str(p.avatar) ?? str(c.photo),
        bannerImage: str(p.bannerImage) ?? str(c.bannerImage),
        bannerColor: str(p.bannerColor) ?? str(c.bannerColor),
        days,
        streak: Number(c.streak) || 0,
        xp: Number(c.xp) || 0,
        tier: Number.isInteger(c.tier) ? c.tier : Number(p.league?.tier) || 0,
        topFinishes: Number(c.topFinishes ?? p.league?.topFinishes) || 0,
        badges: (Array.isArray(p.pinnedBadges) ? p.pinnedBadges : Array.isArray(c.badges) ? c.badges : []).filter((b) => typeof b === 'string').slice(0, 6),
        updatedAt: '',
      },
      shares: shares.docs
        .map((d) => ({ slug: d.id, image: ownImage(d.get('image'), owner) }))
        .filter((s) => s.image),
    }
    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=3600')
    return res.status(200).send(JSON.stringify(body))
  } catch {
    return res.status(500).send('{"error":"unavailable"}')
  }
}
