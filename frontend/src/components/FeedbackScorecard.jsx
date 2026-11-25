// The exercise scorecard (lib/muscle-feedback.js scorecard, a fork feature): pump against joint
// pain per exercise from the muscle feedback, so the ones worth keeping and the ones to swap stand
// out. On Stats, once feedback is switched on and something has been answered.
import { useMemo, useState } from 'react'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'
import { EXIDX } from '../lib/exercises.js'
import { scorecard, feedbackOn } from '../lib/muscle-feedback.js'
import CardHead from './CardHead.jsx'
import { Button } from './ui.jsx'

const VERDICT = {
  keep: { label: () => t('Keep'), color: 'var(--green)' },
  watch: { label: () => t('Watch'), color: 'var(--orange)' },
  swap: { label: () => t('Swap'), color: 'var(--red)' },
}
const SHOWN = 6

export default function FeedbackScorecard({ S }) {
  const rows = useMemo(() => scorecard(S?.workouts), [S?.workouts])
  const [all, setAll] = useState(false)
  if (!feedbackOn(S) || !rows.length) return null
  // Swap first, then watch, then keep, so what needs a decision leads.
  const order = { swap: 0, watch: 1, keep: 2 }
  const sorted = [...rows].sort((a, b) => (order[a.verdict] ?? 3) - (order[b.verdict] ?? 3))
  const list = all ? sorted : sorted.slice(0, SHOWN)
  const swaps = rows.filter(r => r.verdict === 'swap').length
  return <div className="card" data-feedback-scorecard>
    <CardHead icon="figureStrength" tint="var(--red)" eyebrow={t('Muscle feedback')} title={t('Exercise scorecard')}
      sub={swaps ? t('{0} worth swapping: more joint pain than pump.', fmtNum(swaps)) : t('Pump against joint pain, from your answers after each exercise.')} />
    <div className="dfc-ins">
      {list.map(r => {
        const ex = EXIDX[r.id] || { id: r.id }
        const v = r.verdict ? VERDICT[r.verdict] : null
        return <div className="dfc-in" key={r.id}>
          <div className="dfc-in-m">
            <div className={'dfc-in-t ' + exerciseNameClass(ex)}>{exerciseNameFor(ex)}</div>
            <div className="dfc-in-s">{[
              r.pump != null ? t('Pump {0} of 2', fmtNum(r.pump)) : null,
              r.joint != null ? t('Joints {0} of 3', fmtNum(r.joint)) : null,
              t('{0} answers', fmtNum(r.n)),
            ].filter(Boolean).join(' · ')}</div>
          </div>
          <span className="small" style={{ fontWeight: 600, color: v ? v.color : 'var(--label-2)' }}>{v ? v.label() : t('Too early')}</span>
        </div>
      })}
    </div>
    {sorted.length > SHOWN && <div style={{ marginTop: 8 }}>
      <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>{all ? t('Show fewer') : t('Show all {0}', fmtNum(sorted.length))}</Button>
    </div>}
  </div>
}
