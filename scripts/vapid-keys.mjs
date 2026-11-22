/**
 * A key pair for Web Push (VAPID). Run once: `node scripts/vapid-keys.mjs`,
 * then put the values in Vercel's environment as it says. Nothing is
 * written anywhere by this script.
 */
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')])
const b64url = (b) => b.toString('base64url')

console.log('Add these in Vercel › Settings › Environment Variables:\n')
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`)
console.log(`VITE_VAPID_PUBLIC_KEY=${b64url(raw)}`)
console.log(`VAPID_PRIVATE_KEY=${priv.d}`)
console.log('VAPID_SUBJECT=mailto:you@your-domain.com')
console.log('\n(VAPID_SUBJECT: put your own address after mailto:, one push services can contact.)')
console.log('Run this once and keep the pair: each run makes a new one.')
