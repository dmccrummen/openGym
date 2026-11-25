// @vitest-environment happy-dom
// Muscle feedback (lib/muscle-feedback.js, a fork feature), end to end through the store: the
// sheet saves its answers on the running entry, and finishing the workout keeps them with it and
// sets the routine up for next time.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { finishWorkoutNow, muscleFeedbackSheet } from './sheets.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []
let host

function renderTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
}
const pick = (group, label) => act(() => [...host.querySelector(`[aria-labelledby="${group}"]`).querySelectorAll('button')]
  .find(b => b.textContent === label).click())
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)

const done = n => Array.from({ length: n }, () => ({ w: 90, r: 10, done: true }))
function install({ on = true } = {}) {
  const st = clone(DEF)
  st.muscleFeedback = on
  st.routines = [{ id: 'rA', name: 'Workout A', ex: [{ id: '0025', sets: 3, reps: 10, weight: 90 }, { id: '0314', sets: 3, reps: 10, weight: 35 }] }]
  st.workouts = [{ id: 'w0', d: '2026-11-16', routineIds: ['rA'], entries: [{ id: '0025', sets: done(3) }] }]
  st.active = {
    id: 'a1', d: '2026-11-23', start: Date.now() - 30 * 60000, routineIds: ['rA'], routineId: 'rA', name: 'Workout A', bw: null, cur: 0,
    entries: [
      { id: '0025', rid: 'rA', target: { sets: 3, reps: 10, weight: 90 }, sets: done(3) },
      { id: '0314', rid: 'rA', target: { sets: 3, reps: 10, weight: 35 }, sets: done(3) },
    ],
  }
  useStore.setState({ S: st, user: null })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], timer: null, work: null })
})
afterEach(() => {
  mounted.splice(0).forEach(r => act(() => r.unmount()))
  document.body.innerHTML = ''
})

describe('muscle feedback through a workout', () => {
  it('saves the answers on the entry, then adds a set to the best exercise at the finish', () => {
    install()
    muscleFeedbackSheet(0, { muscle: 'chest', sore: true, vol: false })
    renderTopSheet()
    pick('mfb-sore', 'Healed a while ago')
    pick('mfb-pump', 'Moderate pump')
    pick('mfb-joint', 'Moderate pain')
    act(() => button('Save').click())
    expect(S().active.entries[0].fb).toEqual({ mu: 'chest', sore: 1, pump: 1, joint: 2 })

    let after = false
    muscleFeedbackSheet(1, { muscle: 'chest', sore: false, vol: true }, () => { after = true })
    renderTopSheet()
    pick('mfb-pump', 'Moderate pump')
    pick('mfb-joint', 'None')
    pick('mfb-vol', 'Not enough')
    act(() => button('Save').click())
    expect(after).toBe(true)

    act(() => finishWorkoutNow())
    const w = S().workouts.at(-1)
    expect(w.entries.map(e => e.fb)).toEqual([
      { mu: 'chest', sore: 1, pump: 1, joint: 2 },
      { mu: 'chest', pump: 1, joint: 0, vol: 0 },
    ])
    // Recovered early, not enough volume: a set more, on the incline (same pump, no joint pain);
    // the bench's joint pain holds its weight next time.
    expect(S().routines[0].ex).toEqual([
      { id: '0025', sets: 3, reps: 10, weight: 90, fbJoint: true },
      { id: '0314', sets: 3, reps: 10, weight: 35, fbAdj: 1 },
    ])
  })

  it('changes no routine with the setting off', () => {
    install({ on: false })
    useStore.getState().update(s => {
      s.active.entries[0].fb = { mu: 'chest', sore: 0, pump: 1 }
      s.active.entries[1].fb = { mu: 'chest', vol: 0 }
    })
    act(() => finishWorkoutNow())
    expect(S().routines[0].ex).toEqual([{ id: '0025', sets: 3, reps: 10, weight: 90 }, { id: '0314', sets: 3, reps: 10, weight: 35 }])
  })
})
