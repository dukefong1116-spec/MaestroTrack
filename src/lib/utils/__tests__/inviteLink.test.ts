import { describe, expect, it } from 'vitest'
import { tokenFromScan } from '../inviteLink'

/**
 * The camera path cannot be driven in development — on a phone the app is
 * served over plain http on the LAN, where getUserMedia does not exist —
 * so the parsing it depends on is covered here instead.
 */
describe('tokenFromScan', () => {
  const TOKEN = 'W-omk0XKOx1is--jIWfv7w'

  it('reads the token out of the link the invite sheet shows', () => {
    expect(tokenFromScan(`https://maestro-track.vercel.app/join/${TOKEN}`)).toBe(TOKEN)
  })

  it('copes with the addresses the app is actually served from', () => {
    expect(tokenFromScan(`http://localhost:5174/join/${TOKEN}`)).toBe(TOKEN)
    expect(tokenFromScan(`http://192.168.0.64:5174/join/${TOKEN}`)).toBe(TOKEN)
  })

  it('ignores whatever a share sheet appended', () => {
    expect(tokenFromScan(`https://x.dev/join/${TOKEN}?utm_source=whatsapp`)).toBe(TOKEN)
    expect(tokenFromScan(`https://x.dev/join/${TOKEN}#top`)).toBe(TOKEN)
  })

  it('accepts a bare token, which some scanners hand back', () => {
    expect(tokenFromScan(TOKEN)).toBe(TOKEN)
    expect(tokenFromScan(`  ${TOKEN}  `)).toBe(TOKEN)
  })

  it('refuses a QR code that is not ours', () => {
    expect(tokenFromScan('WIFI:S=CafeNet;T=WPA;P=hunter2;;')).toBeNull()
    expect(tokenFromScan('https://example.com/')).toBeNull()
    expect(tokenFromScan('https://example.com/join')).toBeNull()
    expect(tokenFromScan('tel:+441234567890')).toBeNull()
    expect(tokenFromScan('')).toBeNull()
    expect(tokenFromScan('   ')).toBeNull()
  })

  it('refuses something token-shaped but too short to be one', () => {
    expect(tokenFromScan('abc123')).toBeNull()
    expect(tokenFromScan('https://x.dev/join/abc123')).toBeNull()
  })

  it('does not take a token from the middle of a longer path', () => {
    // /join/<token>/something is not an invitation link, and treating it
    // as one would send a guess to Firestore.
    expect(tokenFromScan(`https://x.dev/join/${TOKEN}/extra`)).toBeNull()
  })
})
