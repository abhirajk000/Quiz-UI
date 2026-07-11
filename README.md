# Quiz UI

A lightweight quiz app for learning and self-testing. Load a JSON quiz, answer multiple-choice and open-ended questions, and review your score — in the browser or as a native macOS desktop app.

Built with **React**, **TypeScript**, **Vite**, and **Tauri**.

## Download (macOS)

Pre-built installer for Apple Silicon Macs (aarch64):

**[Download Quiz_1.0.0_aarch64.dmg](release/Quiz_1.0.0_aarch64.dmg)**

1. Open the `.dmg` and drag **Quiz** into Applications
2. On first launch, allow **Microphone** and **Speech Recognition** if you use voice answers
3. Load a quiz JSON from the home screen (sample included)

> Requires macOS 10.15+. To build from source or target other platforms, see [Getting started](#getting-started).

## Features

- **Two question types**
  - **MCQ (`quiz`)** — auto-submit on selection, instant correct/incorrect feedback, optional explanation
  - **Q&A (`qna`)** — type or speak your answer, then check against the model answer
- **Glass Blossom UI** — light/dark theme with soft glass surfaces and pink accent
- **Progress tracking** — question counter, correct count, per-question timer, progress bar
- **Voice input (Q&A)** — record audio and get live speech-to-text while you speak (Web Speech API)
- **Home screen tools** — paste or upload JSON, sample quiz included, one-click ChatGPT prompt generator
- **Keyboard shortcuts** — navigate and submit without reaching for the mouse
- **macOS app** — packaged with Tauri as a fixed-size `480×640` window (resizable)

## Tech stack

| Layer | Tools |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Motion | Framer Motion |
| Icons | Lucide React |
| Build | Vite 7 |
| Desktop | Tauri 2 (macOS DMG) |

## Prerequisites

**Web development**

- [Node.js](https://nodejs.org/) 18+

**macOS desktop build**

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Xcode Command Line Tools (`xcode-select --install`)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Run in the browser

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 3. Run as a macOS app (development)

```bash
npm run tauri:dev
```

### 4. Build for production

**Web**

```bash
npm run build
npm run preview
```

**macOS DMG**

```bash
npm run tauri:build
```

The `.dmg` is written under `src-tauri/target/release/bundle/dmg/`. A copy for GitHub releases is kept at [`release/Quiz_1.0.0_aarch64.dmg`](release/Quiz_1.0.0_aarch64.dmg).

## Quiz JSON format

Quizzes are plain JSON files. See [`public/sample-quiz.json`](public/sample-quiz.json) for a working example.

```json
{
  "title": "React Context API",
  "questions": [
    {
      "type": "quiz",
      "question": "Context API is used for?",
      "options": ["Routing", "Prop Drilling", "Global State", "Database"],
      "answer": 2,
      "explanation": "Context API shares global state without prop drilling."
    },
    {
      "type": "qna",
      "question": "Explain Context API.",
      "answer": "Context API allows sharing data across components without prop drilling."
    }
  ]
}
```

### Field reference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | `string` | yes | Shown in the quiz header |
| `questions` | `array` | yes | Ordered list of questions |
| `type` | `"quiz"` \| `"qna"` | yes | Question kind |
| `question` | `string` | yes | Prompt text |
| `options` | `string[]` | MCQ only | Answer choices |
| `answer` | `number` \| `string` | yes | MCQ: 0-based index; Q&A: reference answer |
| `explanation` | `string` | MCQ only | Shown after submitting an MCQ |

### Generate quizzes with ChatGPT

On the home screen, click **ChatGPT prompt** to open ChatGPT with a pre-filled template. Fill in your topic and question counts, then paste the returned JSON back into the app.

## Keyboard shortcuts

Active on the quiz screen. Shortcuts (except `Ctrl+Enter`) are ignored while a text field is focused.

| Key | Action |
| --- | --- |
| `Ctrl+Enter` | Submit MCQ / check Q&A answer |
| `←` / `→` | Previous / next question |
| `S` | Show answer (Q&A) |
| `R` | Retry (Q&A) |
| `Space` | Start / stop recording (Q&A) |

## Voice input & macOS permissions

Q&A questions support:

1. **Live transcription** — words appear in the text box as you speak (Web Speech API)
2. **Audio recording** — playback of your spoken answer

For the **Tauri macOS app**, allow **Microphone** and **Speech Recognition** when prompted. If speech does not work:

1. Open **System Settings → Privacy & Security**
2. Enable **Quiz** under **Microphone** and **Speech Recognition**
3. Quit and reopen the app

Test with a production build (`npm run tauri:build`) for the most reliable permission prompts.

In the browser, microphone access requires `https://` or `localhost`. Live speech works best in Chromium-based browsers (Chrome, Edge).

## Project structure

```
├── src/
│   ├── QuizApp.tsx      # Main app: home, quiz flow, results
│   ├── App.tsx          # Root component
│   ├── index.css        # Blossom glass theme & component styles
│   └── main.tsx         # Entry point
├── public/
│   └── sample-quiz.json # Default sample quiz
├── src-tauri/           # Tauri desktop shell (Rust)
│   ├── tauri.conf.json
│   ├── Info.plist       # macOS mic + speech usage strings
│   └── Entitlements.plist
└── package.json
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build web assets to `dist/` |
| `npm run preview` | Preview production web build |
| `npm run tauri:dev` | Run Quiz as a macOS dev app |
| `npm run tauri:build` | Build macOS `.dmg` installer |

## Notes

- **No backend** — quizzes and answers live in memory for the session only
- **No persistence** — audio recordings are object URLs; they are cleared on retry or navigation
- **Self-contained UI** — the quiz experience is driven by a single JSON payload

## License

MIT
