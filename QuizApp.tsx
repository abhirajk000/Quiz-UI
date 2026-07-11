/**
 * QuizApp.tsx
 * -----------------------------------------------------------------------
 * A lightweight, native-feeling desktop quiz app. Single file, no backend,
 * no routing, no Redux. Everything lives in memory for the lifetime of the
 * session — nothing is persisted, and recordings are never saved to disk.
 *
 * Drop this file into any React + TypeScript + Tailwind project.
 * Requires: react, tailwindcss.
 * Optional: none — animation is done with plain CSS transitions so there
 * is no dependency on Framer Motion. If you already have framer-motion in
 * your project you can swap the `transition-*` utility classes for
 * <motion.div> variants without changing any logic.
 *
 * Tailwind note: this file does NOT rely on the `dark:` variant / your
 * tailwind.config darkMode setting. Instead each themed value is looked up
 * from the THEME table below and rendered as a complete literal className
 * string, so it works regardless of how your project's Tailwind config is
 * set up.
 * -----------------------------------------------------------------------
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* =========================================================================
   TYPES
   ========================================================================= */

interface QuizQuestion {
  type: "quiz";
  question: string;
  options: string[];
  answer: number; // index into options
}

interface QnaQuestion {
  type: "qna";
  question: string;
  answer: string;
}

type Question = QuizQuestion | QnaQuestion;

interface QuizData {
  title: string;
  questions: Question[];
}

/** Per-question answer state, indexed the same as quizData.questions */
interface QuizAnswerState {
  selected: number | null; // for "quiz" type
  submitted: boolean; // for "quiz" type — locks the choice in
  text: string; // for "qna" type
  audioUrl: string | null; // for "qna" type — object URL of the recording
  showAnswer: boolean;
}

type Stage = "home" | "quiz" | "result";
type Theme = "light" | "dark";

/* =========================================================================
   THEME TABLE — exact palette from the design spec, no gradients, no neon.
   ========================================================================= */

const THEME = {
  light: {
    pageBg: "bg-[#FFFFFF]",
    cardBg: "bg-[#FFFFFF]",
    border: "border-[#E5E7EB]",
    primaryText: "text-[#111827]",
    secondaryText: "text-[#6B7280]",
    accent: "text-[#2563EB]",
    accentBg: "bg-[#2563EB]",
    accentBgHover: "hover:bg-[#1D4ED8]",
    trackBg: "bg-[#E5E7EB]",
    inputBg: "bg-[#FFFFFF]",
    subtleBg: "bg-[#F9FAFB]",
    subtleBgHover: "hover:bg-[#F3F4F6]",
    danger: "text-[#DC2626]",
    success: "text-[#16A34A]",
  },
  dark: {
    pageBg: "bg-[#0F1115]",
    cardBg: "bg-[#171A20]",
    border: "border-[#2B3038]",
    primaryText: "text-[#F9FAFB]",
    secondaryText: "text-[#A1A1AA]",
    accent: "text-[#3B82F6]",
    accentBg: "bg-[#3B82F6]",
    accentBgHover: "hover:bg-[#2563EB]",
    trackBg: "bg-[#2B3038]",
    inputBg: "bg-[#0F1115]",
    subtleBg: "bg-[#1D2027]",
    subtleBgHover: "hover:bg-[#23262E]",
    danger: "text-[#F87171]",
    success: "text-[#4ADE80]",
  },
} as const;

/* =========================================================================
   SMALL SHARED PRIMITIVES
   ========================================================================= */

/** A plain button styled per spec: rounded, subtle hover-darken, 150ms, slight scale on press. */
function Btn({
  children,
  onClick,
  variant = "secondary",
  disabled,
  className = "",
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: "button" | "submit";
}) {
  const { theme } = useThemeCtx();
  const t = THEME[theme];

  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-medium " +
    "transition-all duration-150 ease-out active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed select-none";

  const variants: Record<string, string> = {
    primary: `${t.accentBg} ${t.accentBgHover} text-white shadow-sm`,
    secondary: `${t.subtleBg} ${t.subtleBgHover} ${t.primaryText} border ${t.border}`,
    ghost: `${t.primaryText} hover:opacity-70`,
    danger: `${t.subtleBg} ${t.subtleBgHover} ${t.danger} border ${t.border}`,
  };

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Fade + slight-scale wrapper used for question / card transitions. */
function FadeCard({
  children,
  keyProp,
  className = "",
}: {
  children: React.ReactNode;
  keyProp: string | number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyProp]);

  return (
    <div
      className={`transition-all duration-150 ease-out ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* Minimal theme context so nested components (Btn) can read the palette
   without prop-drilling it through every layer. */
const ThemeCtx = React.createContext<{ theme: Theme }>({ theme: "light" });
const useThemeCtx = () => React.useContext(ThemeCtx);

/* =========================================================================
   ICONS — tiny inline SVGs, no icon library dependency.
   ========================================================================= */

const Icon = {
  Sun: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={p.className} stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </svg>
  ),
  Moon: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={p.className} stroke="currentColor" strokeWidth="1.6">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
    </svg>
  ),
  Mic: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={p.className} stroke="currentColor" strokeWidth="1.6">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path strokeLinecap="round" d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  ),
  Stop: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={p.className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  Play: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={p.className}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  ),
  Trash: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={p.className} stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />
    </svg>
  ),
  Upload: (p: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={p.className} stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  ),
};

/** Parse quiz JSON, using the first complete object if extra content was pasted. */
function parseQuizJson(text: string): QuizData {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Paste or upload quiz JSON to get started.");
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    if (start === -1) {
      throw new Error("Could not parse JSON.");
    }

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          data = JSON.parse(trimmed.slice(start, i + 1));
          break;
        }
      }
    }

    if (data === undefined) {
      throw new Error("Could not parse JSON.");
    }
  }

  const quiz = data as Partial<QuizData>;
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error('JSON must include a non-empty "questions" array.');
  }
  for (const q of quiz.questions) {
    if (q.type !== "quiz" && q.type !== "qna") {
      throw new Error('Each question needs "type": "quiz" or "qna".');
    }
  }

  return { title: quiz.title ?? "Untitled Quiz", questions: quiz.questions };
}

/* =========================================================================
   HOME SCREEN
   ========================================================================= */

function Home({
  theme,
  onToggleTheme,
  onLoad,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onLoad: (data: QuizData) => void;
}) {
  const t = THEME[theme];
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseAndLoad = useCallback(
    (text: string) => {
      try {
        const data = parseQuizJson(text);
        setError(null);
        onLoad(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not parse JSON.");
      }
    },
    [onLoad]
  );

  // Parse immediately as the user pastes/types.
  const handleChange = (value: string) => {
    setRaw(value);
    if (value.trim().length === 0) {
      setError(null);
      return;
    }
    try {
      parseQuizJson(value);
      setError(null);
    } catch {
      // Stay quiet while the user is still typing/pasting — only surface
      // an error on submit, not on every keystroke.
    }
  };

  // Ctrl+V global paste support anywhere on the home screen.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text");
      if (text && text.trim().startsWith("{")) {
        setRaw(text);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRaw(text);
      parseAndLoad(text);
    };
    reader.readAsText(file);
  };

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center ${t.pageBg} transition-colors duration-150`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      <button
        onClick={onToggleTheme}
        title="Toggle theme"
        className={`fixed top-5 right-5 rounded-[10px] p-2 ${t.subtleBg} ${t.subtleBgHover} ${t.primaryText} border ${t.border} transition-all duration-150 active:scale-[0.98]`}
      >
        {theme === "light" ? <Icon.Moon className="w-4 h-4" /> : <Icon.Sun className="w-4 h-4" />}
      </button>

      <FadeCard keyProp="home" className="w-full max-w-md px-6">
        <div
          className={`rounded-[12px] border ${t.border} ${t.cardBg} shadow-sm p-8 ${
            dragging ? "ring-2 ring-offset-0 ring-[#2563EB]" : ""
          }`}
        >
          <h1 className={`text-xl font-semibold tracking-tight ${t.primaryText}`}>Quiz</h1>
          <p className={`mt-1 text-sm ${t.secondaryText}`}>
            Paste a JSON quiz, load a file, or drop one anywhere on this screen.
          </p>

          <textarea
            value={raw}
            onChange={(e) => handleChange(e.target.value)}
            placeholder='{ "title": "...", "questions": [ ... ] }'
            spellCheck={false}
            rows={7}
            className={`mt-5 w-full resize-none rounded-[10px] border ${t.border} ${t.inputBg} ${t.primaryText} text-sm font-mono px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#2563EB] transition-all duration-150 placeholder:${t.secondaryText}`}
          />

          {error && <p className={`mt-2 text-xs ${t.danger}`}>{error}</p>}

          <div className="mt-4 flex items-center gap-2">
            <Btn
              variant="secondary"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon.Upload className="w-4 h-4" />
              Load JSON File
            </Btn>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          <Btn
            variant="primary"
            className="mt-3 w-full"
            disabled={raw.trim().length === 0}
            onClick={() => parseAndLoad(raw)}
          >
            Start
          </Btn>
        </div>
      </FadeCard>
    </div>
  );
}

/* =========================================================================
   PROGRESS BAR
   ========================================================================= */

function ProgressBar({
  current,
  total,
  theme,
}: {
  current: number;
  total: number;
  theme: Theme;
}) {
  const t = THEME[theme];
  const pct = total === 0 ? 0 : ((current + 1) / total) * 100;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={`text-xs font-medium ${t.secondaryText}`}>Question</span>
        <span className={`text-xs font-medium ${t.secondaryText}`}>
          {current + 1} / {total}
        </span>
      </div>
      <div className={`h-1 w-full rounded-full ${t.trackBg} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${t.accentBg} transition-[width] duration-300 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   QUIZ (MULTIPLE CHOICE) QUESTION
   ========================================================================= */

function QuizQuestionCard({
  q,
  state,
  onSelect,
  onSubmit,
  theme,
}: {
  q: QuizQuestion;
  state: QuizAnswerState;
  onSelect: (i: number) => void;
  onSubmit: () => void;
  theme: Theme;
}) {
  const t = THEME[theme];

  return (
    <div>
      <h2 className={`text-lg font-semibold leading-snug ${t.primaryText}`}>{q.question}</h2>

      <div className="mt-5 flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const isSelected = state.selected === i;
          const isCorrect = i === q.answer;
          const showResult = state.submitted;

          let optionClasses = `${t.border} ${t.primaryText}`;
          if (showResult && isCorrect) {
            optionClasses = `border-[#16A34A] ${theme === "dark" ? "bg-[#0F1115]" : "bg-[#F0FDF4]"} ${t.primaryText}`;
          } else if (showResult && isSelected && !isCorrect) {
            optionClasses = `border-[#DC2626] ${theme === "dark" ? "bg-[#0F1115]" : "bg-[#FEF2F2]"} ${t.primaryText}`;
          } else if (isSelected) {
            optionClasses = `border-[#2563EB] ${t.primaryText}`;
          }

          return (
            <label
              key={i}
              className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-sm cursor-pointer transition-all duration-150 ${optionClasses} ${
                state.submitted ? "cursor-default" : t.subtleBgHover
              }`}
            >
              <input
                type="radio"
                name={q.question}
                className="accent-[#2563EB]"
                disabled={state.submitted}
                checked={isSelected}
                onChange={() => onSelect(i)}
              />
              <span className="flex-1">{opt}</span>
              {state.submitted && isCorrect && <span className={`text-xs ${t.success}`}>Correct</span>}
              {state.submitted && isSelected && !isCorrect && <span className={`text-xs ${t.danger}`}>Your pick</span>}
            </label>
          );
        })}
      </div>

      {!state.submitted && (
        <Btn
          variant="primary"
          className="mt-5"
          disabled={state.selected === null}
          onClick={onSubmit}
        >
          Submit
        </Btn>
      )}
    </div>
  );
}

/* =========================================================================
   QNA (TYPED + VOICE) QUESTION
   ========================================================================= */

function QnaQuestionCard({
  q,
  state,
  onTextChange,
  onToggleAnswer,
  onRecordingComplete,
  onClearRecording,
  registerRecordControls,
  theme,
}: {
  q: QnaQuestion;
  state: QuizAnswerState;
  onTextChange: (text: string) => void;
  onToggleAnswer: () => void;
  onRecordingComplete: (url: string) => void;
  onClearRecording: () => void;
  registerRecordControls: (start: () => void, stop: () => void, isRecording: boolean) => void;
  theme: Theme;
}) {
  const t = THEME[theme];
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        onRecordingComplete(url);
        stream.getTracks().forEach((tr) => tr.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;

      // Optional live transcription via the Web Speech API — best-effort,
      // silently skipped in browsers that don't support it.
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          onTextChange(transcript);
        };
        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setMicError("Microphone access was denied or is unavailable.");
    }
  }, [onRecordingComplete, onTextChange]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  useEffect(() => {
    registerRecordControls(startRecording, stopRecording, isRecording);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRecording, stopRecording, isRecording]);

  // Clean up on question change / unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      recognitionRef.current?.stop();
    };
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div>
      <h2 className={`text-lg font-semibold leading-snug ${t.primaryText}`}>{q.question}</h2>

      <textarea
        value={state.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Type your answer…"
        rows={6}
        className={`mt-5 w-full resize-none rounded-[10px] border ${t.border} ${t.inputBg} ${t.primaryText} text-sm px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#2563EB] transition-all duration-150`}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!isRecording ? (
          <Btn variant="secondary" onClick={startRecording} title="Space">
            <Icon.Mic className="w-4 h-4" /> Record
          </Btn>
        ) : (
          <Btn variant="danger" onClick={stopRecording} title="Space">
            <Icon.Stop className="w-4 h-4" /> Stop
          </Btn>
        )}

        {isRecording && <span className={`text-xs font-mono ${t.secondaryText}`}>{fmt(seconds)}</span>}

        {state.audioUrl && !isRecording && (
          <>
            <Btn
              variant="secondary"
              onClick={() => {
                const audio = new Audio(state.audioUrl!);
                audio.play();
              }}
            >
              <Icon.Play className="w-4 h-4" /> Play
            </Btn>
            <Btn variant="danger" onClick={onClearRecording}>
              <Icon.Trash className="w-4 h-4" /> Clear
            </Btn>
          </>
        )}
      </div>

      {micError && <p className={`mt-2 text-xs ${t.danger}`}>{micError}</p>}

      <div className="mt-5">
        <button
          onClick={onToggleAnswer}
          title="S"
          className={`text-sm font-medium ${t.accent} hover:opacity-75 transition-opacity duration-150`}
        >
          {state.showAnswer ? "Hide Answer" : "Show Answer"}
        </button>
        <div
          className={`grid transition-all duration-200 ease-out ${
            state.showAnswer ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0 mt-0"
          }`}
          style={{ display: "grid" }}
        >
          <div className="overflow-hidden">
            <div className={`rounded-[10px] border ${t.border} ${t.subtleBg} px-3.5 py-3 text-sm ${t.primaryText}`}>
              {q.answer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   RESULT SCREEN
   ========================================================================= */

function ResultScreen({
  theme,
  onToggleTheme,
  quizData,
  answers,
  onRestart,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  quizData: QuizData;
  answers: QuizAnswerState[];
  onRestart: () => void;
}) {
  const t = THEME[theme];

  const quizQuestions = quizData.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.type === "quiz") as { q: QuizQuestion; i: number }[];

  const correct = quizQuestions.filter(({ q, i }) => answers[i].selected === q.answer).length;
  const wrong = quizQuestions.length - correct;
  const pct = quizQuestions.length === 0 ? 0 : Math.round((correct / quizQuestions.length) * 100);

  return (
    <div className={`min-h-screen w-full flex items-center justify-center ${t.pageBg} transition-colors duration-150`}>
      <button
        onClick={onToggleTheme}
        title="Toggle theme"
        className={`fixed top-5 right-5 rounded-[10px] p-2 ${t.subtleBg} ${t.subtleBgHover} ${t.primaryText} border ${t.border} transition-all duration-150 active:scale-[0.98]`}
      >
        {theme === "light" ? <Icon.Moon className="w-4 h-4" /> : <Icon.Sun className="w-4 h-4" />}
      </button>

      <FadeCard keyProp="result" className="w-full max-w-sm px-6">
        <div className={`rounded-[12px] border ${t.border} ${t.cardBg} shadow-sm p-8 text-center`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${t.secondaryText}`}>Completed</p>
          <h1 className={`mt-2 text-4xl font-semibold tracking-tight ${t.primaryText}`}>{pct}%</h1>
          <p className={`mt-1 text-sm ${t.secondaryText}`}>{quizData.title}</p>

          {quizQuestions.length > 0 && (
            <div className={`mt-6 flex rounded-[10px] border ${t.border} overflow-hidden`}>
              <div className={`flex-1 py-3 ${t.subtleBg}`}>
                <div className={`text-lg font-semibold ${t.success}`}>{correct}</div>
                <div className={`text-xs ${t.secondaryText}`}>Correct</div>
              </div>
              <div className={`w-px ${t.border} border-l`} />
              <div className={`flex-1 py-3 ${t.subtleBg}`}>
                <div className={`text-lg font-semibold ${t.danger}`}>{wrong}</div>
                <div className={`text-xs ${t.secondaryText}`}>Wrong</div>
              </div>
            </div>
          )}

          <Btn variant="primary" className="mt-6 w-full" onClick={onRestart}>
            Restart
          </Btn>
        </div>
      </FadeCard>
    </div>
  );
}

/* =========================================================================
   APP ROOT
   ========================================================================= */

function makeInitialAnswers(questions: Question[]): QuizAnswerState[] {
  return questions.map(() => ({
    selected: null,
    submitted: false,
    text: "",
    audioUrl: null,
    showAnswer: false,
  }));
}

export default function QuizApp() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });
  const [stage, setStage] = useState<Stage>("home");
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswerState[]>([]);

  // Bridge so global keyboard shortcuts (Space) can trigger the currently
  // mounted QnaQuestionCard's own record/stop handlers.
  const recordControls = useRef<{ start: () => void; stop: () => void; isRecording: boolean }>({
    start: () => {},
    stop: () => {},
    isRecording: false,
  });

  const t = THEME[theme];
  const total = quizData?.questions.length ?? 0;
  const currentQ = quizData?.questions[index] ?? null;
  const currentAns = answers[index];

  const toggleTheme = () => setTheme((th) => (th === "light" ? "dark" : "light"));

  const handleLoad = (data: QuizData) => {
    setQuizData(data);
    setAnswers(makeInitialAnswers(data.questions));
    setIndex(0);
    setStage("quiz");
  };

  const updateAnswer = useCallback(
    (i: number, patch: Partial<QuizAnswerState>) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], ...patch };
        return next;
      });
    },
    []
  );

  const goNext = useCallback(() => {
    if (!quizData) return;
    if (index < total - 1) {
      setIndex((i) => i + 1);
    } else {
      setStage("result");
    }
  }, [index, total, quizData]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const submitQuiz = useCallback(() => {
    if (currentAns?.selected === null || currentAns === undefined) return;
    updateAnswer(index, { submitted: true });
  }, [currentAns, index, updateAnswer]);

  const retry = useCallback(() => {
    // Retry clears textarea + recording + timer, but keeps the same question.
    updateAnswer(index, { text: "", audioUrl: null });
  }, [index, updateAnswer]);

  const restart = () => {
    if (!quizData) return;
    setAnswers(makeInitialAnswers(quizData.questions));
    setIndex(0);
    setStage("quiz");
  };

  const backToHome = () => {
    setStage("home");
    setQuizData(null);
    setAnswers([]);
    setIndex(0);
  };

  /* ---------------------- Keyboard shortcuts (quiz stage) ---------------------- */
  useEffect(() => {
    if (stage !== "quiz" || !currentQ) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "TEXTAREA" || target.tagName === "INPUT";

      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (currentQ.type === "quiz" && !currentAns.submitted) submitQuiz();
        return;
      }

      if (isTyping) return; // don't hijack typing for the rest of the shortcuts

      if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key.toLowerCase() === "r") {
        if (currentQ.type === "qna") retry();
      } else if (e.key.toLowerCase() === "s") {
        if (currentQ.type === "qna") updateAnswer(index, { showAnswer: !currentAns.showAnswer });
      } else if (e.code === "Space" && currentQ.type === "qna") {
        e.preventDefault();
        if (recordControls.current.isRecording) {
          recordControls.current.stop();
        } else {
          recordControls.current.start();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage, currentQ, currentAns, index, goNext, goPrev, retry, submitQuiz, updateAnswer]);

  return (
    <ThemeCtx.Provider value={{ theme }}>
      {stage === "home" && <Home theme={theme} onToggleTheme={toggleTheme} onLoad={handleLoad} />}

      {stage === "quiz" && quizData && currentQ && currentAns && (
        <div className={`min-h-screen w-full ${t.pageBg} transition-colors duration-150`}>
          <div className="max-w-xl mx-auto px-6 py-10">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={backToHome}
                className={`text-sm ${t.secondaryText} hover:opacity-75 transition-opacity duration-150`}
              >
                ← {quizData.title}
              </button>
              <button
                onClick={toggleTheme}
                title="Toggle theme"
                className={`rounded-[10px] p-2 ${t.subtleBg} ${t.subtleBgHover} ${t.primaryText} border ${t.border} transition-all duration-150 active:scale-[0.98]`}
              >
                {theme === "light" ? <Icon.Moon className="w-4 h-4" /> : <Icon.Sun className="w-4 h-4" />}
              </button>
            </div>

            <ProgressBar current={index} total={total} theme={theme} />

            <div className={`mt-6 rounded-[12px] border ${t.border} ${t.cardBg} shadow-sm p-7`}>
              <FadeCard keyProp={index}>
                {currentQ.type === "quiz" ? (
                  <QuizQuestionCard
                    q={currentQ}
                    state={currentAns}
                    theme={theme}
                    onSelect={(i) => !currentAns.submitted && updateAnswer(index, { selected: i })}
                    onSubmit={submitQuiz}
                  />
                ) : (
                  <QnaQuestionCard
                    q={currentQ}
                    state={currentAns}
                    theme={theme}
                    onTextChange={(text) => updateAnswer(index, { text })}
                    onToggleAnswer={() => updateAnswer(index, { showAnswer: !currentAns.showAnswer })}
                    onRecordingComplete={(url) => updateAnswer(index, { audioUrl: url })}
                    onClearRecording={() => updateAnswer(index, { audioUrl: null })}
                    registerRecordControls={(start, stop, isRecording) => {
                      recordControls.current = { start, stop, isRecording };
                    }}
                  />
                )}
              </FadeCard>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Btn variant="secondary" disabled={index === 0} onClick={goPrev} title="←">
                Previous
              </Btn>

              <div className="flex items-center gap-2">
                {currentQ.type === "qna" && (
                  <Btn variant="secondary" onClick={retry} title="R">
                    Retry
                  </Btn>
                )}
                <Btn variant="primary" onClick={goNext} title="→">
                  {index === total - 1 ? "Finish" : "Next"}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "result" && quizData && (
        <ResultScreen
          theme={theme}
          onToggleTheme={toggleTheme}
          quizData={quizData}
          answers={answers}
          onRestart={restart}
        />
      )}
    </ThemeCtx.Provider>
  );
}
