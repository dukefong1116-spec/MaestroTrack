/**
 * POST /api/league/sync — after a timer session is saved or deleted, and
 * when the League tab opens. Body: { tzOffset } — minutes east of UTC.
 * See api/_lib/league.js for everything it does.
 */
import { handler, callerUid, jsonBody } from '../_lib/admin.js'
import { syncLeague } from '../_lib/league.js'

export default handler(async (req) => {
  const uid = await callerUid(req)
  const { tzOffset } = await jsonBody(req)
  return syncLeague(uid, { tzOffset })
})
