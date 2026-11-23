/**
 * POST /api/push/register — where to reach this device, for whoever is
 * signed in. Body: { deviceId, platform: 'ios' | 'web', token, env, tzOffset }.
 */
import { handler, callerUid, jsonBody, HttpError } from '../_lib/admin.js'
import { registerDevice } from '../_lib/push.js'
import { validPushEndpoint } from '../_lib/webpush.js'

export default handler(async (req) => {
  const uid = await callerUid(req)
  const { deviceId, platform, token, env, tzOffset } = await jsonBody(req)
  if (typeof deviceId !== 'string' || !/^[\w-]{8,64}$/.test(deviceId)) throw new HttpError(400, 'Bad device.')
  if (platform !== 'ios' && platform !== 'web') throw new HttpError(400, 'Bad platform.')
  if (typeof token !== 'string' || token.length < 32 || token.length > 4000) throw new HttpError(400, 'Bad token.')
  if (platform === 'ios' && !/^[0-9a-f]{32,200}$/.test(token)) throw new HttpError(400, 'Bad token.')
  if (platform === 'web') {
    let sub
    try { sub = JSON.parse(token) } catch { throw new HttpError(400, 'Bad token.') }
    if (!validPushEndpoint(sub?.endpoint) || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new HttpError(400, 'Bad token.')
  }
  await registerDevice(uid, { deviceId, platform, token, env, tzOffset: Number(tzOffset) })
  return { ok: true }
})
