// Muscle feedback (lib/muscle-feedback.js): what is asked when, the set changes it makes and the
// exercise scorecard.
import { describe, it, expect } from 'vitest'
import {
  primaryMuscleOf, questionsFor, withFeedback, readFeedback, muscleDelta, feedbackChanges,
  applyFeedbackChanges, setsWithFeedback, holdsForJoint, scorecard, MAX_ADD,
} from './muscle-feedback.js'
import { buildSessionEntries } from './session-start.js'
import { isWarmupRow } from './workout-model.js'

const BENCH = '0025', INCLINE = '0314', ROW = '0861', GOBLET = '1760', RDL = '1459', WALK = '3666', CURL = '0031'
const done = (n, w = 50, r = 10) => Array.from({ length: n }, () => ({ w, r, done: true }))
const open = (n, w = 50, r = 10) => Array.from({ length: n }, () => ({ w, r, done: false }))
const entry = (id, sets, extra = {}) => ({ id, target: { sets: sets.length, reps: 10 }, sets, ...extra })
const pastChest = { id: 'w0', d: '2026-11-16', entries: [entry(BENCH, done(3))] }

const state = (entries, { on = true, workouts = [pastChest] } = {}) => ({
  muscleFeedback: on, unit: 'lb', workouts, routines: [],
  active: { id: 'a1', d: '2026-11-23', routineIds: ['rA'], entries },
})

describe('which muscle an exercise is about', () => {
  it('takes the first main muscle it trains fully, in body order', () => {
    expect(primaryMuscleOf({ id: BENCH })).toBe('chest')
    expect(primaryMuscleOf({ id: ROW })).toBe('lats')
    expect(primaryMuscleOf({ id: GOBLET })).toBe('quadriceps')
    expect(primaryMuscleOf({ id: RDL })).toBe('hamstring')
  })
  it('has none for cardio', () => {
    expect(primaryMuscleOf({ id: WALK })).toBe(null)
  })
})

describe('what is asked', () => {
  it('asks nothing while the setting is off', () => {
    expect(questionsFor(state([entry(BENCH, done(3))], { on: false }), 0)).toBe(null)
  })

  it('asks soreness on the first chest exercise and holds volume while more chest is to come', () => {
    const S = state([entry(BENCH, done(3)), entry(INCLINE, open(3))])
    expect(questionsFor(S, 0)).toEqual({ muscle: 'chest', sore: true, vol: false })
  })

  it('asks volume on the last chest exercise, and soreness only once', () => {
    const S = state([entry(BENCH, done(3), { fb: { mu: 'chest', sore: 1 } }), entry(INCLINE, done(3))])
    expect(questionsFor(S, 1)).toEqual({ muscle: 'chest', sore: false, vol: true })
  })

  it('skips soreness for a muscle never trained before', () => {
    const S = state([entry(BENCH, done(3))], { workouts: [] })
    expect(questionsFor(S, 0)).toEqual({ muscle: 'chest', sore: false, vol: true })
  })

  it('asks nothing about cardio', () => {
    expect(questionsFor(state([{ id: WALK, target: { mode: 'cardio', min: 8 }, sets: [{ min: 8, done: true }] }]), 0)).toBe(null)
  })
})

describe('storing answers', () => {
  it('keeps answers in range and drops a cleared one', () => {
    const fb = withFeedback({ pump: 2 }, { joint: 1, pump: null, vol: 9 }, 'chest')
    expect(fb).toEqual({ mu: 'chest', joint: 1 })
    expect(readFeedback(fb)).toEqual({ mu: 'chest', pump: null, joint: 1, sore: null, vol: null })
    expect(readFeedback({ mu: 'chest' })).toBe(null)
  })
})

describe('one set more, the same or one fewer', () => {
  it('backs off when still sore or too much', () => {
    expect(muscleDelta({ sore: 3, vol: 0 })).toBe(-1)
    expect(muscleDelta({ sore: 0, vol: 3 })).toBe(-1)
  })
  it('holds when it only just healed or was pushed to the limit', () => {
    expect(muscleDelta({ sore: 2, vol: 0 })).toBe(0)
    expect(muscleDelta({ sore: 0, vol: 2 })).toBe(0)
  })
  it('adds when recovered early and the work was not enough or just right', () => {
    expect(muscleDelta({ sore: 0, vol: 0 })).toBe(1)
    expect(muscleDelta({ sore: 1, vol: 1, pump: 1 })).toBe(1)
    expect(muscleDelta({ vol: 0 })).toBe(1)
  })
  it('holds a just-right session that already had an amazing pump', () => {
    expect(muscleDelta({ sore: 1, vol: 1, pump: 2 })).toBe(0)
  })
  it('changes nothing without soreness or volume', () => {
    expect(muscleDelta({ pump: 0 })).toBe(0)
    expect(muscleDelta()).toBe(0)
  })
})

describe('changes to the routine', () => {
  const routines = () => [{ id: 'rA', name: 'Workout A', ex: [{ id: BENCH, sets: 3, reps: 10 }, { id: INCLINE, sets: 3, reps: 10 }, { id: CURL, sets: 2, reps: 10 }] }]
  const finishedWith = entries => ({ id: 'w1', d: '2026-11-23', routineIds: ['rA'], entries })

  it('adds a set to the chest exercise with the best pump for its joints', () => {
    const w = finishedWith([
      entry(BENCH, done(3), { fb: { mu: 'chest', sore: 1, pump: 1, joint: 2 } }),
      entry(INCLINE, done(3), { fb: { mu: 'chest', pump: 2, joint: 0, vol: 1 } }),
    ])
    const S = { routines: routines(), workouts: [w] }
    const changes = feedbackChanges(S, w)
    // pump 2 with vol "just right" holds the sets: only the joint answers go through,
    // a mark on the bench and none (cleared) on the incline
    expect(changes).toEqual([
      { rid: 'rA', id: BENCH, muscle: null, delta: 0, joint: true },
      { rid: 'rA', id: INCLINE, muscle: null, delta: 0, joint: false },
    ])

    const w2 = finishedWith([
      entry(BENCH, done(3), { fb: { mu: 'chest', sore: 0, pump: 1, joint: 2 } }),
      entry(INCLINE, done(3), { fb: { mu: 'chest', pump: 1, joint: 0, vol: 0 } }),
    ])
    const c2 = feedbackChanges({ routines: routines(), workouts: [w2] }, w2)
    expect(c2).toContainEqual({ rid: 'rA', id: INCLINE, muscle: 'chest', delta: 1, joint: false })
    expect(c2).toContainEqual({ rid: 'rA', id: BENCH, muscle: null, delta: 0, joint: true })
  })

  it('takes the set off the exercise worst for its joints', () => {
    const w = finishedWith([
      entry(BENCH, done(3), { fb: { mu: 'chest', sore: 3, pump: 0, joint: 3 } }),
      entry(INCLINE, done(3), { fb: { mu: 'chest', pump: 2, joint: 0, vol: 1 } }),
    ])
    const changes = feedbackChanges({ routines: routines(), workouts: [w] }, w)
    expect(changes.find(c => c.id === BENCH)).toEqual({ rid: 'rA', id: BENCH, muscle: 'chest', delta: -1, joint: true })
  })

  it('adds nothing once the muscle is at the top of its weekly range', () => {
    const big = finishedWith([entry(BENCH, done(20), { fb: { mu: 'chest', sore: 0, vol: 0, pump: 1 } })])
    expect(feedbackChanges({ routines: routines(), workouts: [big] }, big)).toEqual([])
  })

  it('skips an exercise its routine no longer has', () => {
    const w = finishedWith([entry(ROW, done(3), { fb: { mu: 'lats', sore: 0, vol: 0 } })])
    expect(feedbackChanges({ routines: routines(), workouts: [w] }, w)).toEqual([])
  })

  it('keeps the offset between one set left and MAX_ADD more', () => {
    let rs = routines()
    for (let i = 0; i < 6; i++) rs = applyFeedbackChanges(rs, [{ rid: 'rA', id: CURL, delta: 1, joint: null }])
    expect(rs[0].ex[2].fbAdj).toBe(MAX_ADD)
    for (let i = 0; i < 9; i++) rs = applyFeedbackChanges(rs, [{ rid: 'rA', id: CURL, delta: -1, joint: null }])
    expect(rs[0].ex[2].fbAdj).toBe(-1)
    expect(setsWithFeedback(rs[0].ex[2])).toBe(1)
    // the routine's own sets are never touched
    expect(rs[0].ex[2].sets).toBe(2)
  })

  it('marks and clears joint pain, and drops an offset back at zero', () => {
    let rs = applyFeedbackChanges(routines(), [{ rid: 'rA', id: BENCH, delta: 1, joint: true }])
    expect(rs[0].ex[0]).toMatchObject({ fbAdj: 1, fbJoint: true })
    expect(holdsForJoint(rs[0].ex[0])).toBe(true)
    expect(setsWithFeedback(rs[0].ex[0])).toBe(4)
    rs = applyFeedbackChanges(rs, [{ rid: 'rA', id: BENCH, delta: -1, joint: false }])
    expect(rs[0].ex[0]).toEqual({ id: BENCH, sets: 3, reps: 10 })
    // an untouched slot is the same object
    const before = routines()
    expect(applyFeedbackChanges(before, [{ rid: 'rA', id: BENCH, delta: 1, joint: null }])[0].ex[1]).toBe(before[0].ex[1])
  })
})

describe('the exercise scorecard', () => {
  const day = (d, entries) => ({ id: d, d, entries })
  it('averages pump and joint pain per exercise and gives a verdict from two answers', () => {
    const ws = [
      day('2026-11-02', [entry(BENCH, done(3), { fb: { pump: 0, joint: 2 } }), entry(INCLINE, done(3), { fb: { pump: 2, joint: 0 } })]),
      day('2026-11-09', [entry(BENCH, done(3), { fb: { pump: 1, joint: 2 } }), entry(INCLINE, done(3), { fb: { pump: 2, joint: 0 } })]),
      day('2026-11-16', [entry(CURL, done(2), { fb: { pump: 1, joint: 0 } })]),
    ]
    const rows = scorecard(ws)
    expect(rows.map(r => r.id)).toEqual([CURL, BENCH, INCLINE])
    expect(rows.find(r => r.id === BENCH)).toMatchObject({ n: 2, pump: 0.5, joint: 2, verdict: 'swap' })
    expect(rows.find(r => r.id === INCLINE)).toMatchObject({ n: 2, pump: 2, joint: 0, verdict: 'keep' })
    expect(rows.find(r => r.id === CURL)).toMatchObject({ n: 1, verdict: null })
  })
})

describe('a session built after feedback', () => {
  const work = e => e.sets.filter(s => !isWarmupRow(s))
  const base = { id: BENCH, sets: 3, reps: 10, repsMin: 8, weight: 90 }
  // Last time: every set at the top of 8-10, so double progression would add weight.
  const st = {
    unit: 'lb', exWeights: {}, routines: [],
    workouts: [{ d: '2026-11-16', routineIds: ['rA'], entries: [{ id: BENCH, target: { ...base }, planned: { sets: 3, reps: 10, repsMin: 8, weight: 90 }, sets: [10, 10, 10].map(r => ({ w: 90, r, done: true })) }] }],
  }

  it('opens with a set more, and keeps progressing the weight', () => {
    const [e] = buildSessionEntries(st, { id: 'rA', prog: 'double', ex: [{ ...base, fbAdj: 1 }] })
    expect(work(e)).toHaveLength(4)
    expect(e.target.sets).toBe(4)
    expect(work(e)[0].w).toBeGreaterThan(90)
    // the routine's own plan is what it was, so progression does not read a changed plan
    expect(e.planned.sets).toBe(3)
    expect(e.plan.fbWhy).toEqual(['Your feedback: {0} sets instead of {1}.', 4, 3])
  })

  it('holds the weight after joint pain instead of raising it', () => {
    const [e] = buildSessionEntries(st, { id: 'rA', prog: 'double', ex: [{ ...base, fbJoint: true }] })
    expect(work(e).every(s => s.w === 90)).toBe(true)
    expect(e.plan.kind).toBe('hold')
  })

  it('opens as the routine says without feedback', () => {
    const [e] = buildSessionEntries(st, { id: 'rA', prog: 'double', ex: [{ ...base }] })
    expect(work(e)).toHaveLength(3)
    expect(e.plan.fbWhy).toBeUndefined()
  })
})
