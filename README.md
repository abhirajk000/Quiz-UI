# Quiz App

A single-file React + TypeScript component: `QuizApp.tsx`. No backend, no
routing, no Redux — everything lives in memory for the session.

## Setup

1. Drop `QuizApp.tsx` into a Vite or CRA project that has **Tailwind CSS**
   installed.
2. Render it, e.g. in `App.tsx`:

   ```tsx
   import QuizApp from "./QuizApp";
   export default function App() {
     return <QuizApp />;
   }
   ```

3. Try it with `sample-quiz.json` — paste its contents into the home
   screen, load it as a file, or drag-and-drop it onto the window.

## Notes

- **Colors** are hard-coded per the spec (exact light/dark hex values) as
  literal Tailwind arbitrary-value classes, so this works regardless of
  your `tailwind.config` — no `darkMode: 'class'` setup required.
- **Animation** uses plain CSS transitions (`transition-all duration-150`,
  `scale-[0.98]`) instead of Framer Motion, so there's no extra
  dependency. Swap them for `<motion.div>` if you'd prefer.
- **Microphone / speech recognition** requires the page to be served over
  `https://` or `localhost`, and the browser to grant mic permission.
  Live transcription via the Web Speech API is a progressive enhancement
  — it silently no-ops in browsers that don't support it (e.g. Firefox);
  recording/playback still works everywhere `MediaRecorder` is supported.
- **Nothing is persisted.** Recordings live only in memory as object URLs
  and are discarded on Retry, Clear, or navigating away.

## Keyboard shortcuts (active on the quiz screen)

| Key | Action |
|---|---|
| `Space` | Start / stop recording (qna questions) |
| `Ctrl+Enter` | Submit (quiz questions) |
| `←` / `→` | Previous / Next question |
| `S` | Show / Hide answer (qna questions) |
| `R` | Retry (qna questions) |

Shortcuts other than `Ctrl+Enter` are suppressed while a text field is
focused, so they don't interfere with typing.
