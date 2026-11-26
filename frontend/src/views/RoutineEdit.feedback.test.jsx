// @vitest-environment happy-dom
// Muscle feedback (lib/muscle-feedback.js, a fork feature) in the routine editor: what it changed,
// and a reset of the routine back to its own sets after a confirm.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'

const mocks = vi.hoisted(() => ({ confirmSheet: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: mocks.confirmSheet }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
let root, container

function renderRoutine(ex, { on = true } = {}) {
  const S = clone(DEF)
  S.muscleFeedback = on
  S.routines = [{ id: 'r1', name: 'Workout A', ex }, { id: 'r2', name: 'Workout B', ex: [{ id: '0861', sets: 3, reps: 10, fbAdj: 1 }] }]
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(
    <MemoryRouter initialEntries={['/routine/r1']}>
      <Routes><Route path="/routine/:id" element={<RoutineEdit />} /></Routes>
    </MemoryRouter>
  ))
}
const card = () => container.querySelector('[data-routine-feedback]')

beforeEach(() => { localStorage.clear(); mocks.confirmSheet.mockReset() })
afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  root = container = null
})

describe('routine editor: muscle feedback', () => {
  it('lists what the feedback changed, and resets this routine only after the confirm', () => {
    renderRoutine([{ id: '0025', sets: 3, reps: 10, fbAdj: 2, fbJoint: true }, { id: '0314', sets: 3, reps: 10 }])
    expect(card().textContent).toContain('5 sets instead of 3 · weight held for joint pain')
    const reset = [...card().querySelectorAll('button')].find(b => b.textContent === 'Reset feedback')
    act(() => reset.click())
    expect(mocks.confirmSheet).toHaveBeenCalledTimes(1)
    expect(useStore.getState().S.routines[0].ex[0].fbAdj).toBe(2)
    act(() => mocks.confirmSheet.mock.calls[0][0].onConfirm())
    const S = useStore.getState().S
    expect(S.routines[0].ex[0]).toEqual({ id: '0025', sets: 3, reps: 10 })
    expect(S.routines[1].ex[0].fbAdj).toBe(1)
    expect(card()).toBeNull()
  })

  it('shows nothing when nothing changed or the setting is off', () => {
    renderRoutine([{ id: '0025', sets: 3, reps: 10 }])
    expect(card()).toBeNull()
    act(() => root.unmount()); container.remove(); root = null
    renderRoutine([{ id: '0025', sets: 3, reps: 10, fbAdj: 1 }], { on: false })
    expect(card()).toBeNull()
  })
})
