/**
 * POST /api/league/ticket — called when the practice timer starts.
 * Returns a signed, time-stamped ticket; see api/_lib/ticket.js.
 */
import { handler, callerUid } from '../_lib/admin.js'
import { issueTicket } from '../_lib/ticket.js'

export default handler(async (req) => ({ ticket: issueTicket(await callerUid(req)) }))
