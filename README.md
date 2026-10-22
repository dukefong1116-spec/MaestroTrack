# MaestroTrack

Practice tracking for music students and their teachers. A student logs what
they practise; the app turns that log into streaks, XP, badges and charts.
Their teacher sees the same practice as progress over time, sets assignments,
reviews what comes back, and keeps a lesson schedule.

Think of it as Strava for musicians, with a teacher attached.

---

## Running it

```bash
npm install
npm run dev
```

That points at the real Firebase project and needs a `.env` — copy
`.env.example` and fill in the values from the Firebase console. To work
without touching production data, use the emulator instead (below).

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server against production Firebase |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run lint` | oxlint |
| `npm test` | Unit tests — pure functions, no network, no emulator |
| `npm run emulate` | Start the Firebase emulators |
| `npm run dev:emulator` | Dev server against the emulators, on port 5174 |
| `npm run test:rules` | Security-rule tests — **needs the emulators running** |

---

## The shape of the app

### One idea runs through all of it: derive, don't store

Streaks, XP, levels, badges, piece statistics and assignment progress are
**never written to the database**. They are pure functions of the practice
session log, recomputed on read. A stored streak is a second source of truth
that drifts the first time a write fails; a derived one cannot disagree with
the sessions it came from.

The consequence worth knowing: if you want to change how XP or streaks work,
you change a function in `src/lib/utils/` and every existing user's figures
change with it. Nothing needs migrating.

### Layers

```
src/
  pages/        screens, by audience — auth/, student/, teacher/
  features/     feature-level components (practice, recordings, teacher, …)
  components/   generic UI with no feature knowledge
  hooks/        data-loading and cross-cutting behaviour
  stores/       Zustand state (auth, practice, teacher, uploads)
  lib/
    firebase/   every database call in the app lives here — nothing else
                imports firebase/firestore directly
    utils/      the derivations: streaks, XP, mastery, analytics, summaries
    audio/      metronome, tuner, recorder — one shared AudioContext
    storage/    IndexedDB holding recordings that have not uploaded yet
  types/        shared types, including every Firestore document shape
```

**`src/lib/firebase/` is the only place that talks to Firestore.** Each module
owns one collection and exports plain functions (`subscribePieces`,
`addPracticeSession`). Screens never build queries. This is load-bearing:
the security rules are tested by calling these exact functions, so a query
written anywhere else would escape that test (see Testing).

Built with React 19, Vite, TypeScript, Tailwind v4, Zustand, framer-motion and
Recharts.

---

## How Firebase is used

Three services, no backend of our own. There is no server code in this repo —
the browser talks to Firebase directly, and **the security rules are the only
thing standing between one user's data and another's.**

### Auth
Email and password. `src/hooks/useAuth.ts` resolves the signed-in user to a
profile document. If that document is missing it rebuilds one from a
`localStorage` cache and writes it back, so a failed profile write does not
leave someone unable to use the app.

### Firestore

| Collection | Holds | Who may read it |
| --- | --- | --- |
| `users` | profiles, role, studio membership | yourself; any teacher's profile (so studio codes can be looked up); your own teacher |
| `practiceSessions` | every logged session | only you |
| `pieces` | repertoire | only you |
| `performances` | performance log | only you |
| `recordings` | audio metadata | you; your teacher, but only for takes you handed in |
| `assignments` | set by a teacher, submitted by a student | the student and the teacher on it |
| `teacherNotes` | a teacher's notes on a student | that teacher and that student |
| `lessonSlots` | schedule | the teacher and the student |
| `practiceSummary` | rolled-up practice, with categories | you and your teacher |
| `studioStats` | daily minutes and streak only | you, your teacher, and classmates |

The last two exist because **a Firestore rule governs a whole document and
cannot withhold a field.** A teacher may see what a student practised; a
classmate may see only how long. That is two audiences, so it has to be two
documents. They are written by the student's own app
(`src/hooks/useSummarySync.ts`) from the session log.

They also solve a scaling problem by accident: a teacher's charts read one
small document per student instead of every session that student has ever
logged.

### Storage
Audio recordings only, at `recordings/{uid}/…`, capped at 200 MB and
`audio/*`. Uploads do not block finishing a session — a take that fails is
kept in IndexedDB (`src/lib/storage/pendingClips.ts`) and retried next visit.

One thing to understand before changing anything here: the Storage rules are
**owner-only**, yet a teacher can play a take that was handed in. That works
because the `audioUrl` stored on the recording is a `getDownloadURL()` link,
and those carry a token that bypasses Storage rules entirely. The rules guard
the *bucket path*; the URL is a bearer token for one file. So what protects a
recording is that only the owner and their teacher can read the row holding
its URL — and un-sharing a take does not invalidate a URL someone already
has. Deleting the recording does.

### Where the rules actually live

`firestore.rules` and `storage.rules` are in this repo and are what the
emulator and the tests run against. **The authoritative copy is the one
published in the Firebase console**, and there is deliberately no deploy
wired up, so a stray `firebase deploy` cannot overwrite it with a stale file.

After changing `firestore.rules`: run `npm run test:rules`, then paste the
file into Firebase console → Firestore Database → Rules → Publish, in the
same change as the commit. A rule that is green here and unpublished there
protects nobody.

---

## Local emulator

Runs Auth, Firestore and Storage on this machine. **Nothing it does can reach
production** — `.firebaserc` defaults to the project id `demo-maestrotrack`,
and Firebase treats any `demo-` prefix as strictly local.

Needs a JDK (Adoptium Temurin 21 or later).

```bash
npm run emulate        # terminal 1 — leave it running
npm run dev:emulator   # terminal 2 — app on http://localhost:5174
```

Emulator UI: <http://127.0.0.1:4000>

**Firestore runs on 8085, not the usual 8080** — 8080 was already taken on the
machine this was set up on, and a port the emulator cannot bind just fails to
start. `firebase.json` and `src/lib/firebase/config.ts` both say 8085; change
both together or neither.

### Checking the app is really on the emulator

The connection is gated twice: `import.meta.env.DEV` (false in any production
build) and `VITE_USE_EMULATOR=1`. So a production build cannot be pointed at
localhost by accident.

Three ways to confirm, in increasing order of how much they prove:

1. The browser console logs `[firebase] using local emulators` at startup.
2. Sign up a user and watch it appear in the emulator UI's Auth tab.
3. Stop the emulator. If the app keeps working, it was never connected.

Emulator data is in memory and vanishes when you stop it. Sign-ups made there
do not exist in production, and vice versa.

---

## Testing

Two suites, deliberately separate.

### `npm test` — unit tests
Pure functions only: streaks, XP, dates, summaries, assignment progress. No
network, no emulator, fast. Pinned to `America/Los_Angeles`, because date
arithmetic here has been wrong in timezone-specific ways more than once.

### `npm run test:rules` — security rules
Needs the emulators running. Five suites, every one of them executing the real
`firestore.rules`:

| Suite | Asks |
| --- | --- |
| `rules.test.ts` | do the app's normal paths work? |
| `rules.attacks.test.ts` | what happens when somebody tries not to play fair? |
| `rules.protected.test.ts` | can a student change `role`, `teacherId`, `studioCode` or their leaderboard row? |
| `rules.storage.test.ts` | the same for audio files |
| `rules.appqueries.test.ts` | do the app's **own** queries pass? |

The last one is the important one, and the reason `src/lib/firebase/` has to
be the only place with queries in it. A Firestore query is allowed only if it
*proves* every document it could return is readable — a fact about the query,
not about the data. So rules can be perfect and the app still broken. That
suite therefore writes no queries of its own: it imports the real modules,
swaps `db` for the emulator, and calls the real functions. It ends with a test
that fails if any exported function in `src/lib/firebase/` is not exercised,
so a new query cannot be added without being checked.

Both bugs that reached users were of exactly that shape.

---

## Deploying

Hosted on Vercel, built from this repo on every push to `main`.

`vercel.json` holds one rewrite, and it is not optional. This is a
single-page app: the server only ever has `index.html`, and the router
makes `/student/settings` and the rest up in the browser. Without the
rewrite, opening such a URL directly — or reloading the page — asks the
server for a file that does not exist and gets a 404. The rewrite says
"whatever was asked for, serve index.html and let the app sort it out".

### Environment variables

`.env` is gitignored, so the build on Vercel cannot see it. The same six
`VITE_FIREBASE_*` names have to be set in the Vercel project's
Environment Variables, with the values from your local `.env`. A missing
one does not fail the build — it produces an app that loads and then
cannot reach Firebase at all.

These values are not secrets. Firebase client configuration ships inside
every web app that uses it and is readable by anyone who opens the page;
what protects the data is the security rules, not the config.

### After the first deploy

Add the deployed domain under Firebase console → Authentication →
Settings → Authorized domains. Firebase only accepts sign-ins from
domains listed there, `localhost` being allowed by default. Until it is
added the app loads normally and every sign-in fails.

### Indexes

Deployed separately, and needed before anyone else uses the app:

```bash
npx firebase deploy --only firestore:indexes --project <your-project-id>
```

Two screens — a student's practice history and a teacher's view of
handed-in recordings — run queries that need a composite index. Without
one they return nothing rather than failing, so the symptom is an empty
page and no error.

---

## Known limits

Worth knowing before trusting a number on screen.

- **Summaries are self-reported.** `practiceSummary` and `studioStats` are
  written by the student's own browser. A modified client could inflate them.
  Rules pin the `uid` and the display name to the account, but cannot check
  whether the minutes are true.
- **Nothing validates values.** A session may claim 60,000 minutes or be dated
  2099. Rules check *who* writes and *what shape*, never whether a figure is
  plausible.
- **Studio codes are guessable.** Joining looks a teacher up by code, which
  requires signed-in users to be able to read teacher profiles.
- **`studioStats` has no reader yet.** The rules and the writer exist; no
  screen draws the classmate leaderboard.
- **Un-sharing a recording does not take it back.** See Storage above: the
  download URL keeps working until the file is deleted.

The first two have the same answer — a server that computes these figures
instead of accepting them — and that is the main thing this app does not yet
have.
