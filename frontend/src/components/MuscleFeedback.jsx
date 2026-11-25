// Muscle feedback after an exercise (lib/muscle-feedback.js, a fork feature): pump and joint pain
// for the exercise, soreness from last time on a muscle's first exercise, the volume on its last.
// Every row is optional; tapping an answer again clears it. Opened from views/Workout.jsx when an
// exercise's last set is ticked, with Settings → Workout → Muscle feedback on.
import { useState } from 'react'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import { PUMP, JOINT, SORE, VOL, muscleName } from '../lib/muscle-feedback.js'

function Choice({ id, label, sub, options, value, onChange }) {
  return <div className="dfc-row">
    <div className="dfc-q" id={id}><span>{label}</span></div>
    {sub && <div className="small muted mfb-sub">{sub}</div>}
    <div className="dfc-scale mfb-scale" role="radiogroup" aria-labelledby={id} style={{ gridTemplateColumns: `repeat(${options.length},1fr)` }}>
      {options.map((o, n) => <button key={n} type="button" role="radio" aria-checked={value === n}
        className={'dfc-pip mfb-pip' + (value === n ? ' on' : '')} onClick={() => onChange(value === n ? null : n)}>{t(o)}</button>)}
    </div>
  </div>
}

/**
 * `ex`: the exercise (for its name). `ask`: { muscle, sore, vol } from questionsFor.
 * `initial`: answers already given (the entry's fb). `onDone(answers)` saves, `onSkip()` closes.
 */
export default function MuscleFeedback({ ex, ask, initial = {}, onDone, onSkip }) {
  const [a, setA] = useState({ pump: initial.pump ?? null, joint: initial.joint ?? null, sore: initial.sore ?? null, vol: initial.vol ?? null })
  const set = k => v => setA(x => ({ ...x, [k]: v }))
  const mu = ask?.muscle ? t(muscleName(ask.muscle)).toLowerCase() : null
  const out = { pump: a.pump, joint: a.joint, ...(ask?.sore ? { sore: a.sore } : {}), ...(ask?.vol ? { vol: a.vol } : {}) }
  return <div className="dfc mfb">
    <h3>{t('Feedback')}</h3>
    {ex && <div className={'muted small dfc-sub ' + exerciseNameClass(ex)}>{exerciseNameFor(ex)}</div>}
    {ask?.sore && <Choice id="mfb-sore" label={t('Soreness')} sub={t('How sore did your {0} get after training it last time?', mu)}
      options={SORE} value={a.sore} onChange={set('sore')} />}
    <Choice id="mfb-joint" label={t('Joint pain')} sub={t('How did your joints feel during this exercise?')}
      options={JOINT} value={a.joint} onChange={set('joint')} />
    <Choice id="mfb-pump" label={t('Pump')} sub={mu ? t('How much of a pump did you get in your {0}?', mu) : t('How much of a pump did you get?')}
      options={PUMP} value={a.pump} onChange={set('pump')} />
    {ask?.vol && <Choice id="mfb-vol" label={t('Volume')} sub={t('How was the number of hard sets for your {0} today?', mu)}
      options={VOL} value={a.vol} onChange={set('vol')} />}
    <Button variant="primary" onClick={() => onDone(out)}>{t('Save')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={onSkip}>{t('Skip')}</Button>
  </div>
}
