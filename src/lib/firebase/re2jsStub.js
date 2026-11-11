/**
 * Stands in for the `re2js` package (see the alias in vite.config.ts).
 *
 * Firestore's web SDK imports re2js — a full regular-expression engine,
 * 46 KB compressed — for one thing only: evaluating the `like`,
 * `regex_contains` and `regex_match` functions of its Pipeline queries on
 * the device. MaestroTrack never builds a Pipeline query, so the engine was
 * pure download on every start. Should one ever be used, Firestore catches
 * this error and logs a warning rather than crashing.
 */
export const RE2JS = {
  compile() {
    throw new Error('Regular-expression queries are not built into MaestroTrack.')
  },
}
