// Muscle feedback (fork feature, in the spirit of RP Hypertrophy's check-ins): a few taps after an
// exercise is done, and the next session of that routine is set up from the answers.
//
// WHAT IS ASKED, when an exercise's last set is ticked (Settings → Workout → Muscle feedback, off
// until switched on). Every answer is optional.
//   - pump:  0 low, 1 moderate, 2 amazing                         (every lifting exercise)
//   - joint: 0 none, 1 low, 2 moderate, 3 a lot                    (every lifting exercise)
//   - sore:  0 never got sore, 1 healed a while ago,               (the first exercise of a muscle
//            2 healed just on time, 3 still sore                    in the session, when that muscle
//                                                                   was trained before)
//   - vol:   0 not enough, 1 just right, 2 pushed my limits,       (the last exercise of a muscle
//            3 too much                                             in the session)
//
// WHERE IT IS KEPT. On the entry of the session, `entry.fb = { mu, pump, joint, sore, vol }`, and
// with the finished workout (finish-workout.js), so the history holds it and the exercise
// scorecard below reads it back. `mu` is the muscle the questions were about.
//
// WHAT IT CHANGES. At the finish, per muscle answered, one set more, the same or one fewer
// (muscleDelta), kept on the routine's exercise as `fbAdj` (an offset to the routine's own sets,
// never the sets themselves: editing those reads as a changed plan to progression.js and would
// hold the weight). It goes to one exercise of that muscle: a set more to the one with the best
// pump for its joints, a set fewer to the one with the worst. No set is added once the muscle is
// at the top of its weekly range (muscle-targets.js). Moderate or worse joint pain marks the
// exercise (`fbJoint`): the next session holds its weight rather than raising it. Both are read by
// session-start.js when a session is built (setsWithFeedback, holdsForJoint).
import { EXIDX } from './exercises.js'
import { musclesOf, MUSCLE_NAME } from './muscles.js'
import { TARGET_MUSCLES, weeklyMuscleSets } from './muscle-targets.js'
import { modeForEntry, isWarmupRow } from './workout-model.js'

export const PUMP = ['Low pump', 'Moderate pump', 'Amazing pump']
export const JOINT = ['None', 'Low pain', 'Moderate pain', 'A lot of pain']
export const SORE = ['Never got sore', 'Healed a while ago', 'Healed just on time', "I'm still sore!"]
export const VOL = ['Not enough', 'Just right', 'Pushed my limits', 'Too much']
const SCALES = { pump: PUMP, joint: JOINT, sore: SORE, vol: VOL }
export const FB_KEYS = ['pump', 'joint', 'sore', 'vol']

/** Most sets feedback may add on top of a routine's own. */
export const MAX_ADD = 3
/** Joint pain from here up holds the weight next time. */
export const JOINT_HOLD = 2

export const feedbackOn = S => S?.muscleFeedback === true

const answer = (k, v) => (Number.isInteger(v) && v >= 0 && v < SCALES[k].length ? v : null)
const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

/** A stored `fb` read back, every answer in range or null; null when nothing was answered. */
export function readFeedback(fb) {
  if (!isMap(fb)) return null
  const out = { mu: typeof fb.mu === 'string' && fb.mu ? fb.mu : null }
  let any = false
  for (const k of FB_KEYS) { out[k] = answer(k, fb[k]); if (out[k] != null) any = true }
  return any ? out : null
}

const exerciseOf = entry => entry?.exercise || EXIDX[entry?.id] || null

/**
 * The muscle an exercise's questions are about: the first main muscle (muscle-targets.js, in body
 * order) it trains as a primary mover. A goblet squat is quads, a Romanian deadlift hamstrings,
 * a row lats. Null for one that trains none of them (cardio, a carry of the whole body).
 */
export function primaryMuscleOf(entryOrEx) {
  const ex = entryOrEx?.n != null || entryOrEx?.tg != null ? entryOrEx : exerciseOf(entryOrEx)
  if (!ex) return null
  const m = musclesOf(ex)
  return TARGET_MUSCLES.find(slug => (m[slug] || 0) >= 1) || null
}

/** A lifting entry: reps or a timed hold. Cardio and distance are not asked about. */
const lifts = entry => ['reps', 'time'].includes(modeForEntry(entry, 'reps'))

const finished = entry => (entry?.sets || []).length > 0 && entry.sets.every(s => s.done)

/** Was `muscle` trained as a primary mover in any finished workout? */
function trainedBefore(workouts, muscle) {
  return (workouts || []).some(w => (w?.entries || []).some(e =>
    (e.sets || []).some(s => s.done && !isWarmupRow(s)) && primaryMuscleOf(e) === muscle))
}

/**
 * What to ask once entry `idx` of the running session `S.active` is done, or null for nothing:
 * `{ muscle, sore, vol }`, the exercise questions (pump, joint pain) always coming with it.
 */
export function questionsFor(S, idx) {
  const entries = S?.active?.entries || []
  const entry = entries[idx]
  if (!feedbackOn(S) || !entry || !lifts(entry)) return null
  const muscle = primaryMuscleOf(entry)
  const same = entries.map((e, i) => ({ e, i })).filter(({ e, i }) => i !== idx && lifts(e) && primaryMuscleOf(e) === muscle)
  // Soreness from last time, once per muscle a session: on its first exercise answered.
  const sore = !!muscle && !same.some(({ e }) => readFeedback(e.fb)?.sore != null) && trainedBefore(S.workouts, muscle)
  // The volume, once all of the muscle's work today is done.
  const vol = !!muscle && same.every(({ e }) => finished(e))
  return { muscle, sore, vol }
}

/** `entry.fb` with the answers in, a cleared answer (null) taken out. */
export function withFeedback(fb, answers, muscle) {
  const out = { ...(isMap(fb) ? fb : {}) }
  if (muscle) out.mu = muscle
  for (const k of FB_KEYS) {
    if (!(k in (answers || {}))) continue
    const v = answer(k, answers[k])
    if (v == null) delete out[k]
    else out[k] = v
  }
  return out
}

/**
 * One set more (+1), the same (0) or one fewer (-1) for a muscle, from its answers:
 *   - still sore, or too much: one fewer;
 *   - healed just on time, or pushed to its limits: the same;
 *   - recovered early (never sore, healed a while ago) with the work not enough: one more;
 *   - recovered early with the work just right: one more, unless the pump was already amazing;
 *   - not enough answers to tell (no soreness and no volume): the same.
 */
export function muscleDelta({ sore = null, vol = null, pump = null } = {}) {
  if (sore === 3 || vol === 3) return -1
  if (sore === 2 || vol === 2) return 0
  if (sore == null && vol == null) return 0
  if (vol === 0) return 1
  if (pump === 2 && vol === 1) return 0
  return 1
}

/** How good an exercise was for its joints: pump up, joint pain down. */
const worth = fb => (fb.pump ?? 1) - (fb.joint ?? 0)

/** The routine and its exercise slot an entry of `workout` was built from, or null. */
function slotOf(routines, workout, entry) {
  const rid = entry.rid || (workout.routineIds || [])[0] || workout.routineId
  const routine = (routines || []).find(r => r && r.id === rid)
  const slot = routine?.ex?.find(c => c && c.id === entry.id)
  return slot ? { routine, slot } : null
}

/**
 * The changes a finished workout's feedback makes to its routines:
 * [{ rid, id, muscle, delta, joint }], `delta` in sets (to the slot's `fbAdj`), `joint` true or
 * false to set `fbJoint`, null to leave it. `S` is the state with the workout already in it, for
 * the weekly range.
 */
export function feedbackChanges(S, workout) {
  const entries = (workout?.entries || []).map(e => ({ e, fb: readFeedback(e.fb) })).filter(x => x.fb)
  if (!entries.length) return []
  const out = new Map()
  const change = (entry, patch) => {
    const at = slotOf(S?.routines, workout, entry)
    if (!at) return
    const key = at.routine.id + ':' + entry.id
    const prev = out.get(key) || { rid: at.routine.id, id: entry.id, muscle: null, delta: 0, joint: null }
    out.set(key, { ...prev, ...patch, delta: prev.delta + (patch.delta || 0) })
  }
  // Joint pain, per exercise: marked from moderate up, cleared once it is answered lower.
  for (const { e, fb } of entries) if (fb.joint != null) change(e, { joint: fb.joint >= JOINT_HOLD })

  const weekly = Object.fromEntries(weeklyMuscleSets(S, workout.d).map(r => [r.slug, r]))
  const muscles = [...new Set(entries.map(x => x.fb.mu).filter(Boolean))]
  for (const mu of muscles) {
    const mine = entries.filter(x => x.fb.mu === mu)
    const sore = mine.map(x => x.fb.sore).find(v => v != null) ?? null
    const vol = mine.map(x => x.fb.vol).filter(v => v != null).at(-1) ?? null
    const pumps = mine.map(x => x.fb.pump).filter(v => v != null)
    const pump = pumps.length ? Math.max(...pumps) : null
    let delta = muscleDelta({ sore, vol, pump })
    // Never past the top of the muscle's weekly range.
    const wk = weekly[mu]
    if (delta > 0 && wk && wk.sets >= wk.hi) delta = 0
    if (!delta) continue
    const ranked = [...mine].sort((a, b) => worth(b.fb) - worth(a.fb))
    const pick = delta > 0 ? ranked[0] : ranked[ranked.length - 1]
    change(pick.e, { muscle: mu, delta })
  }
  return [...out.values()].filter(c => c.delta || c.joint != null)
}

/**
 * Routines with the changes in (a new array, touched routines and slots copied). The offset
 * stays between one fewer than the routine's sets (at least one set is left) and MAX_ADD more.
 */
export function applyFeedbackChanges(routines, changes) {
  if (!changes?.length) return routines
  return (routines || []).map(r => {
    const mine = changes.filter(c => c.rid === r?.id)
    if (!mine.length) return r
    return {
      ...r,
      ex: (r.ex || []).map(slot => {
        const c = mine.find(x => x.id === slot?.id)
        if (!c) return slot
        const next = { ...slot }
        if (c.delta) {
          const base = Math.max(1, Number(slot.sets) || 1)
          const adj = Math.max(1 - base, Math.min(MAX_ADD, (Number(slot.fbAdj) || 0) + c.delta))
          if (adj) next.fbAdj = adj
          else delete next.fbAdj
        }
        if (c.joint === true) next.fbJoint = true
        else if (c.joint === false) delete next.fbJoint
        return next
      }),
    }
  })
}

/** The sets a session opens with for a routine slot: its own plus the feedback's offset. */
export function setsWithFeedback(cfg) {
  const base = Math.max(1, Number(cfg?.sets) || 1)
  const adj = Number(cfg?.fbAdj) || 0
  return Math.max(1, Math.min(base + MAX_ADD, base + adj))
}

/** Does this slot hold its weight next time, for joint pain last time? */
export const holdsForJoint = cfg => cfg?.fbJoint === true

/**
 * The exercise scorecard: per exercise answered at least once, newest first by last answer,
 * `{ id, n, pump, joint, last, verdict }` with `pump` (0 to 2) and `joint` (0 to 3) as averages.
 * `verdict`: 'keep' (good pump, easy on the joints), 'swap' (more joint pain than pump),
 * 'watch' (anything in between) or null until there are `min` answers.
 */
export function scorecard(workouts, { min = 2 } = {}) {
  const by = new Map()
  for (const w of workouts || []) {
    for (const e of w?.entries || []) {
      const fb = readFeedback(e.fb)
      if (!fb || (fb.pump == null && fb.joint == null)) continue
      const row = by.get(e.id) || { id: e.id, pumps: [], joints: [], last: null }
      if (fb.pump != null) row.pumps.push(fb.pump)
      if (fb.joint != null) row.joints.push(fb.joint)
      if (!row.last || (w.d || '') > row.last) row.last = w.d || null
      by.set(e.id, row)
    }
  }
  const avg = xs => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
  return [...by.values()].map(r => {
    const n = Math.max(r.pumps.length, r.joints.length)
    const pump = avg(r.pumps), joint = avg(r.joints)
    let verdict = null
    if (n >= min) {
      if ((joint ?? 0) >= 1.5 && (pump ?? 0) <= 1) verdict = 'swap'
      else if ((pump ?? 0) >= 1.5 && (joint ?? 0) <= 0.5) verdict = 'keep'
      else verdict = 'watch'
    }
    return { id: r.id, n, pump, joint, last: r.last, verdict }
  }).sort((a, b) => (b.last || '').localeCompare(a.last || ''))
}

export const muscleName = slug => MUSCLE_NAME[slug] || slug

// ── Resetting ────────────────────────────────────────────────────────────────────────────────
// RP runs volume in blocks: sets climb through a block, the deload clears them, and the next block
// starts from the routine's own again. "Reset at deload" (S.feedbackDeloadReset, on unless false)
// does that here: finishing a deload session (lib/deload-cycle.js or a programme's deload week)
// clears every routine's set offsets. Joint-pain holds stay: pain is not volume. A deload session's
// own answers change nothing, its sets being cut anyway. The routine editor resets one routine.

export const deloadResetOn = S => S?.feedbackDeloadReset !== false

/** Was this session (running or finished) a deload: any exercise in a deload week? */
export const isDeloadSession = w => (w?.entries || []).some(e => e?.plan?.prog?.deload === true)

/** A routine's exercises the feedback has changed: [{ id, adj, joint }] in routine order. */
export function feedbackOf(routine) {
  return (routine?.ex || []).filter(c => c && ((Number(c.fbAdj) || 0) !== 0 || c.fbJoint === true))
    .map(c => ({ id: c.id, adj: Number(c.fbAdj) || 0, joint: c.fbJoint === true }))
}

/**
 * Routines with the feedback cleared: the set offsets, and with `joint` the joint-pain holds too.
 * `only`: one routine's id, or every routine. Untouched routines and slots stay the same objects.
 */
export function resetFeedback(routines, { only = null, joint = false } = {}) {
  return (routines || []).map(r => {
    if (!r || (only && r.id !== only)) return r
    if (!(r.ex || []).some(c => c && ('fbAdj' in c || (joint && 'fbJoint' in c)))) return r
    return {
      ...r,
      ex: r.ex.map(c => {
        if (!c || !('fbAdj' in c || (joint && 'fbJoint' in c))) return c
        const { fbAdj, fbJoint, ...rest } = c
        return joint || fbJoint == null ? rest : { ...rest, fbJoint }
      }),
    }
  })
}
