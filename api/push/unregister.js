/**
 * POST /api/push/unregister — signing out on this device: its pushes stop.
 * Body: { deviceId }.
 */
import { handler, callerUid, jsonBody, HttpError } from '../_lib/admin.js'
import { unregisterDevice } from '../_lib/push.js'

export default handler(async (req) => {
  const uid = await callerUid(req)
  const { deviceId } = await jsonBody(req)
  if (typeof deviceId !== 'string' || !/^[\w-]{8,64}$/.test(deviceId)) throw new HttpError(400, 'Bad device.')
  await unregisterDevice(uid, deviceId)
  return { ok: true }
})
