# Muscle feedback (fork feature)

RP Hypertrophy-style feedback after each exercise, and a session set up from it next time.
Off until switched on: **Settings → Workout → Muscle feedback**.

## What it asks

After an exercise's last set is ticked, one sheet with up to four rows. Every row is optional,
a second tap clears an answer, and **Skip** saves nothing.

| Row | Asked | Answers |
| --- | --- | --- |
| Soreness | on a muscle's first exercise of the session, if that muscle was trained before | Never got sore · Healed a while ago · Healed just on time · I'm still sore! |
| Joint pain | every lifting exercise | None · Low · Moderate · A lot |
| Pump | every lifting exercise | Low · Moderate · Amazing |
| Volume | on a muscle's last exercise of the session | Not enough · Just right · Pushed my limits · Too much |

An exercise's muscle is the first main muscle it trains fully, in body order: bench press is
chest, goblet squat quads, Romanian deadlift hamstrings, a row lats. Cardio is not asked about.

## What it changes

When the workout is finished, per muscle answered:

| Answers | Next time |
| --- | --- |
| Still sore, or too much | one set fewer |
| Healed just on time, or pushed my limits | the same |
| Recovered early and not enough | one set more |
| Recovered early and just right | one set more, unless the pump was amazing |

- A set more goes to that muscle's exercise with the best pump for its joint pain, a set fewer
  to the one with the worst.
- No set is added once the muscle is at the top of its weekly range (Stats → Weekly sets per muscle).
- The change is an offset on the routine's exercise (`fbAdj`, between one set left and three
  more). The routine's own sets stay as they are, so progression does not read a changed plan
  and keeps moving the weight.
- **Moderate or a lot of joint pain** marks the exercise (`fbJoint`): next time its weight holds
  instead of going up. Answering lower clears it.
- Not in a deload week, a running programme, or under triple progression, which set their own sets.

The workout shows the change on the exercise ("Your feedback: 4 sets instead of 3."), and the
finish shows a line with what changed.

## Resetting

Feedback sets build up through a block, as in RP. Two ways back to the routine's own sets:

- **Reset at deload** (Settings → Workout, under Muscle feedback; on unless switched off).
  Finishing a session in a deload week, from Settings → Deload weeks or a programme's deload week,
  clears every routine's set offsets, so the next block starts over. Joint-pain holds stay.
  A deload session's own answers change no sets either way.
- **Reset feedback** in the routine editor: the card lists what the feedback changed in that
  routine ("5 sets instead of 3 · weight held for joint pain") and resets it, holds included,
  after a confirm.

## Exercise scorecard

Stats shows pump against joint pain per exercise. From two answers each exercise gets a verdict:
**Swap** (joint pain 1.5 or more with pump 1 or less), **Keep** (pump 1.5 or more with joint pain
0.5 or less), **Watch** otherwise.

## Code

`frontend/src/lib/muscle-feedback.js` (logic, tested in `muscle-feedback.test.js`),
`components/MuscleFeedback.jsx` (the sheet), `components/FeedbackScorecard.jsx` (Stats),
hooks in `views/Workout.jsx` (asking), `sheets.jsx` (saving, applying at the finish),
`lib/session-start.js` (the sets and the weight hold) and `lib/finish-workout.js` (kept with the
workout). Images: `.github/workflows/fork-images.yml`.
