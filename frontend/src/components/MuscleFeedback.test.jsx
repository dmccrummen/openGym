// @vitest-environment happy-dom
// The muscle feedback sheet (components/MuscleFeedback.jsx): which rows it shows, answers in and
// out, and a second tap clearing an answer.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MuscleFeedback from './MuscleFeedback.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
const mount = props => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MuscleFeedback ex={{ id: '0025', n: 'barbell bench press' }} {...props} />))
}
afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); root = null })

const rows = () => [...host.querySelectorAll('.dfc-q')].map(e => e.textContent)
const pick = (group, label) => act(() => [...host.querySelector(`[aria-labelledby="${group}"]`).querySelectorAll('button')]
  .find(b => b.textContent === label).click())
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label)

describe('MuscleFeedback', () => {
  it('asks soreness and volume only when told to', () => {
    mount({ ask: { muscle: 'chest', sore: false, vol: false }, onDone: vi.fn(), onSkip: vi.fn() })
    expect(rows()).toEqual(['Joint pain', 'Pump'])
    act(() => root.unmount()); host.remove(); root = null
    mount({ ask: { muscle: 'chest', sore: true, vol: true }, onDone: vi.fn(), onSkip: vi.fn() })
    expect(rows()).toEqual(['Soreness', 'Joint pain', 'Pump', 'Volume'])
    expect(host.textContent).toContain('your chest')
  })

  it('hands back the answers, with a second tap clearing one', () => {
    const onDone = vi.fn()
    mount({ ask: { muscle: 'chest', sore: true, vol: true }, onDone, onSkip: vi.fn() })
    pick('mfb-sore', 'Healed a while ago')
    pick('mfb-pump', 'Amazing pump')
    pick('mfb-joint', 'Low pain')
    pick('mfb-joint', 'Low pain')
    pick('mfb-vol', 'Just right')
    act(() => button('Save').click())
    expect(onDone).toHaveBeenCalledWith({ pump: 2, joint: null, sore: 1, vol: 1 })
  })

  it('leaves out the questions it did not ask', () => {
    const onDone = vi.fn()
    mount({ ask: { muscle: 'chest', sore: false, vol: false }, onDone, onSkip: vi.fn() })
    act(() => button('Save').click())
    expect(onDone).toHaveBeenCalledWith({ pump: null, joint: null })
  })

  it('Skip saves nothing', () => {
    const onDone = vi.fn(), onSkip = vi.fn()
    mount({ ask: { muscle: 'chest', sore: true, vol: true }, onDone, onSkip })
    act(() => button('Skip').click())
    expect(onSkip).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
