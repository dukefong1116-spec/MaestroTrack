/**
 * What every notification says — on the phone (scheduled reminders) and
 * from the server (pushes about other people). One file for both, plain
 * JavaScript with types beside it (copy.d.ts), like the league rules: the
 * server loads it as it is, with no build step.
 *
 * Every kind has several wordings. `compose` picks one that was not used
 * in the last few of that kind, so the same reminder never reads the same
 * twice running. `{name}` style fields are filled from `vars`; a wording
 * whose fields are not all known is skipped.
 *
 * `mood` is Femata's face for it (shown with local reminders).
 * `cat` is the Settings switch that turns it off.
 */

export const COPY = {
  // ── Streak ──────────────────────────────────────────────────────────
  'streak-daily': { cat: 'streak', mood: 'Happy', to: '/student/session', lines: [
    ['Hey {name}!', 'Your {streak}-day streak is waiting. 10 minutes is all it takes 🎵'],
    ['{piece} misses you', 'Quick run-through today?'],
    ['Day {next} is right there', "Let's go, {name}!"],
    ['Femata is tuning up…', 'Are you in? 🎻'],
    ['Five minutes still counts', 'Scales, a passage, anything. Keep the flame going 🔥'],
    ['Practice o’clock, {name}', 'Your flame is ready when you are.'],
  ] },
  'streak-start': { cat: 'streak', mood: 'Happy', to: '/student/session', lines: [
    ['Hey {name}!', 'Ten minutes today starts a streak 🔥'],
    ['Today could be day 1', 'Start small. Start now.'],
    ['Femata is ready when you are', 'One short session lights the flame.'],
  ] },
  'streak-evening': { cat: 'streak', mood: 'Thinking', to: '/student/session', lines: [
    ['The day’s not over yet', 'Your flame is still waiting, {name} 🔥'],
    ['Still time to keep {streak} days', '{left} minutes keeps it going.'],
    ['Quick one before bed?', 'A few minutes keeps your streak alive.'],
    ['Your streak called', 'It said “please” 🥺'],
  ] },
  'streak-danger': { cat: 'lateStreak', mood: 'Surprised', to: '/student/session', exempt: true, lines: [
    ['⏰ 2 hours left', 'Save your {streak}-day streak with one short session.'],
    ['{name}, your streak ends at midnight', 'Ten minutes saves it.'],
    ['Don’t let {streak} days slip away', 'Femata believes in you!'],
  ] },
  'streak-frozen': { cat: 'streak', mood: 'Cool', to: '/student/streak', lines: [
    ['Phew! A freeze saved your streak ❄️', '{streak} days, still going. Practise today to thaw it out.'],
    ['Your streak froze instead of breaking', 'Close call, {name}! Let’s not need the next one 😅'],
    ['The ice held', 'Your {streak}-day streak is safe. Today keeps it that way.'],
  ] },
  'streak-lost': { cat: 'streak', mood: 'Sad', to: '/student/streak', lines: [
    ['Your {streak}-day streak ended', 'Practise today and tomorrow to bring it back 💪'],
    ['Every musician has off days', 'Two days in a row and your {streak} days come back.'],
    ['Comeback time, {name}!', 'Your streak is waiting to be rescued.'],
  ] },

  // ── Practice ────────────────────────────────────────────────────────
  'piece-neglected': { cat: 'streak', mood: 'Thinking', to: '/student/library', lines: [
    ['“{piece}” misses you', 'It hasn’t had any love in {days} days 🎼'],
    ['Remember {piece}?', 'A short run keeps it in your fingers.'],
    ['{piece} is getting dusty…', 'Five minutes today?'],
  ] },
  'performance-soon': { cat: 'streak', mood: 'Focused', to: '/student/library', lines: [
    ['{days} days until {performance}', 'Time for run-throughs!'],
    ['{performance} is coming up', '{days} days to go. You’ve got this, {name}.'],
    ['Countdown: {days} days', 'Play {performance} through once, slowly 🎭'],
  ] },
  'performance-tomorrow': { cat: 'streak', mood: 'Excited', to: '/student/library', lines: [
    ['{performance} is tomorrow!', 'One calm run-through, then rest. You’re ready 🎭'],
    ['Big day tomorrow', 'Good luck with {performance}, {name}!'],
  ] },
  'month-recap': { cat: 'streak', mood: 'Celebrate', to: '/student/practice/progress', lines: [
    ['Your {month} recap is in 🎁', 'See your minutes, your days and your top piece.'],
    ['{month}, wrapped', 'How did your month of practice go? Take a look.'],
  ] },
  'miss-you': { cat: 'streak', mood: 'Sad', to: '/student', lines: [
    ['Femata misses you 🥺', 'Come play something?'],
    ['It’s been a few days!', 'Your {instrument} misses you too.'],
    ['Hey {name}', 'Even five minutes today would make Femata’s day.'],
  ] },

  // ── Studio (student) ────────────────────────────────────────────────
  'assignment-new': { cat: 'assignments', mood: 'Focused', to: '/student/studio', lines: [
    ['{teacher} set you “{title}”', 'Open it to see what to practise.'],
    ['New from {teacher}', '{title}'],
    ['Homework alert! 📝', '{title}, from {teacher}.'],
  ] },
  'assignment-due': { cat: 'assignments', mood: 'Thinking', to: '/student/studio', lines: [
    ['“{title}” is due {when}', 'Ready to hand it in?'],
    ['Due {when}: {title}', 'Record a take tonight?'],
  ] },
  'assignment-approved': { cat: 'feedback', mood: 'Proud', to: '/student/studio', lines: [
    ['{teacher} approved “{title}” ✅', 'Nailed it!'],
    ['Nailed it! 🎉', '{teacher} loved your {title}.'],
  ] },
  'assignment-returned': { cat: 'feedback', mood: 'Excited', to: '/student/studio', lines: [
    ['{teacher} has notes on “{title}”', '{note}'],
    ['Almost there!', '{teacher} sent {title} back with a tip.'],
  ] },
  'piece-from-teacher': { cat: 'assignments', mood: 'Excited', to: '/student/library', lines: [
    ['New piece from {teacher} 🎼', '{piece} is in your Library.'],
    ['{teacher} picked a piece for you', '{piece}! Take a look.'],
  ] },
  'lesson-tomorrow': { cat: 'lessons', mood: 'Happy', to: '/student', lines: [
    ['Lesson with {teacher} tomorrow', 'At {time}. Bring your questions 🎵'],
    ['Tomorrow at {time}', 'Lesson with {teacher}. A quick practice tonight?'],
  ] },
  'lesson-soon': { cat: 'lessons', mood: 'Focused', to: '/student', lines: [
    ['Lesson in an hour!', 'Warm up with a quick run of {piece}?'],
    ['See {teacher} at {time} 🎵', 'Time to warm up.'],
  ] },
  'message-from-teacher': { cat: 'studio', mood: 'Wink', to: '/student/studio/messages', exempt: true, lines: [
    ['{teacher}', '{preview}'],
  ] },
  'joined-studio': { cat: 'studio', mood: 'Celebrate', to: '/student/studio', exempt: true, lines: [
    ['You’re in! 🎉', 'Welcome to {studio}.'],
    ['Welcome to {studio}', '{teacher} accepted you.'],
  ] },

  // ── League ──────────────────────────────────────────────────────────
  'league-passed': { cat: 'league', mood: 'Surprised', to: '/student/league', lines: [
    ['{rival} just passed you!', 'You’re #{rank} now. Fight back? 💪'],
    ['Uh oh, {rival} is ahead', 'A short session gets you back up.'],
    ['Dropped to #{rank}', '{rival} overtook you. Your move 🎻'],
  ] },
  'league-last-day': { cat: 'league', mood: 'Focused', to: '/student/league', lines: [
    ['League ends tonight!', 'Every minute counts ⏱️'],
    ['Final day of the league week', 'One more session could move you up.'],
  ] },

  // ── Teacher ─────────────────────────────────────────────────────────
  'work-handed-in': { cat: 'submissions', mood: 'Thinking', to: '/teacher/review', lines: [
    ['{student} handed in “{title}” 🎧', 'Ready for you to listen.'],
    ['New recording from {student}', '{title} is waiting for review.'],
  ] },
  'join-request': { cat: 'studio', mood: 'Happy', to: '/teacher/students', exempt: true, lines: [
    ['{student} wants to join {studio}', 'Say yes from Students 👋'],
    ['New student at the door', '{student} asked to join.'],
  ] },
  'message-from-student': { cat: 'studio', mood: 'Wink', to: '/teacher/messages', exempt: true, lines: [
    ['{student}', '{preview}'],
  ] },
  'teacher-lesson-soon': { cat: 'lessons', mood: 'Focused', to: '/teacher', lines: [
    ['Next up: {student}', 'At {time}, {minutes} min.'],
    ['{student} at {time}', 'Your lesson starts in 15 minutes.'],
  ] },
  'lesson-note-due': { cat: 'lessons', mood: 'Thinking', to: '/teacher', lines: [
    ['How did {student}’s lesson go?', 'Leave a quick note while it’s fresh.'],
    ['Lesson with {student} done', 'What did you cover, and what’s next?'],
    ['A note for {student}?', 'Two lines now saves remembering it next week.'],
    ['Wrap up {student}’s lesson', 'Jot down the homework and what to work on.'],
  ] },
  'students-quiet': { cat: 'digest', mood: 'Thinking', to: '/teacher/students', lines: [
    ['{count} students went quiet', 'No practice in 5 days. A nudge?'],
    ['{student} hasn’t practised lately', 'Five days quiet. Maybe a message?'],
  ] },
  'studio-week': { cat: 'digest', mood: 'Cool', to: '/teacher', lines: [
    ['Your studio’s week 📊', 'See who practised, and how much.'],
    ['Week in review', 'How your students did this week.'],
  ] },
}

/** Fills `{field}`s; null when a field is missing. */
function fill(text, vars) {
  let missing = false
  const out = text.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k]
    if (v === undefined || v === null || v === '') { missing = true; return '' }
    return String(v)
  })
  return missing ? null : out
}

/**
 * A notification's words for `kind`: a wording not among `recent` (indexes
 * used lately) whose fields are all known, picked by `seed` when given.
 * Returns null when none fits.
 */
export function compose(kind, vars = {}, recent = [], seed) {
  const c = COPY[kind]
  if (!c) return null
  const options = c.lines
    .map((line, index) => ({ index, title: fill(line[0], vars), body: fill(line[1], vars) }))
    .filter((o) => o.title !== null && o.body !== null)
  if (!options.length) return null
  const fresh = options.filter((o) => !recent.includes(o.index))
  const pool = fresh.length ? fresh : options
  // A seed (the phone's planner) gives the same words every time the plan
  // is rebuilt; without one (the server), any fresh one.
  const pick = pool[(seed === undefined ? Math.floor(Math.random() * pool.length) : Math.abs(seed)) % pool.length]
  return { kind, title: pick.title, body: pick.body, index: pick.index, mood: c.mood, to: c.to, cat: c.cat, exempt: !!c.exempt }
}

/** How many of each kind's recent wordings to avoid repeating. */
export const RECENT = 3
/** At most this many a day (exempt ones aside). */
export const DAILY_CAP = 3
/** Quiet hours: from this hour… */
export const QUIET_FROM = 21
/** …until this one. */
export const QUIET_TO = 8

export function isQuiet(hour) {
  return hour >= QUIET_FROM || hour < QUIET_TO
}
