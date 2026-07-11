/**
 * QuizApp.tsx — LearnPlayer-style quiz UI (Blossom theme)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  HelpCircle,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Timer,
  Trophy,
  Upload,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface QuizQuestion {
  type: "quiz";
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
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

interface QuizAnswerState {
  selected: number | null;
  submitted: boolean;
  text: string;
  audioUrl: string | null;
  showAnswer: boolean;
}

type Stage = "home" | "quiz" | "result";
type Theme = "light" | "dark";

const OPTION_IDS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const DEFAULT_SAMPLE_JSON = `{
  "title": "React Context API",
  "questions": [
    {
      "type": "quiz",
      "question": "Context API is used for?",
      "options": ["Routing", "Prop Drilling", "Global State", "Database"],
      "answer": 2,
      "explanation": "Context API is designed to share global state across the component tree without passing props through every intermediate component."
    },
    {
      "type": "qna",
      "question": "Explain Context API.",
      "answer": "Context API allows sharing data across components without prop drilling."
    },
    {
      "type": "quiz",
      "question": "Which hook do you use to consume a Context value?",
      "options": ["useState", "useContext", "useReducer", "useMemo"],
      "answer": 1,
      "explanation": "useContext reads the current value from a Context object created with React.createContext()."
    },
    {
      "type": "qna",
      "question": "When would you reach for Context instead of a state manager like Redux?",
      "answer": "When state is relatively simple and mostly read in many places without complex update logic — Context avoids the extra dependency and boilerplate."
    }
  ]
}`;

const CHATGPT_PROMPT_TEMPLATE = `Topic - 

Number of quiz - 

Number of qna - 

Create a quiz JSON for my Learn Quiz app. Return ONLY valid JSON (no markdown, no code fences).

Use this exact structure:
{
  "title": "<Topic>",
  "questions": [
    {
      "type": "quiz",
      "question": "<multiple choice question>",
      "options": ["option A", "option B", "option C", "option D"],
      "answer": 0,
      "explanation": "<why this answer is correct>"
    },
    {
      "type": "qna",
      "question": "<open-ended question>",
      "answer": "<model short answer>"
    }
  ]
}

Rules:
- "type": "quiz" = multiple choice. "answer" is the 0-based index of the correct option.
- "type": "qna" = open answer. "answer" is a short string.
- Include "explanation" only on quiz questions.
- Create the number of quiz and qna questions I filled in above.
- Keep questions clear and beginner-friendly.`;

function openChatGptWithPrompt(prompt: string) {
  const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function optionId(index: number): string {
  return OPTION_IDS[index] ?? String(index);
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function parseQuizJson(text: string): QuizData {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Paste or upload quiz JSON to get started.");

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    if (start === -1) throw new Error("Could not parse JSON.");

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

    if (data === undefined) throw new Error("Could not parse JSON.");
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

function ShellBackground() {
  return <div className="quiz-shell-orb" aria-hidden />;
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : (score / total) * 100;
  const offset = c - (pct / 100) * c;

  return (
    <div className="score-ring">
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--sidebar-track)" strokeWidth="8" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-hover)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="score-ring-value">
        {score}/{total}
      </span>
    </div>
  );
}

function QuizFooter({
  index,
  total,
  canGoNext,
  onPrev,
  onNext,
  qna,
}: {
  index: number;
  total: number;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  qna?: {
    showAnswer: boolean;
    canCheck: boolean;
    onRetry: () => void;
    onCheck: () => void;
  };
}) {
  const isLast = index >= total - 1;

  return (
    <footer className="quiz-footer">
      <div className="quiz-footer-group quiz-footer-group--start">
        <button
          type="button"
          disabled={index === 0}
          onClick={onPrev}
          className="quiz-footer-btn quiz-footer-btn--ghost"
        >
          <ChevronLeft size={15} strokeWidth={2.25} aria-hidden />
          <span>Back</span>
        </button>
      </div>

      <div className="quiz-footer-group quiz-footer-group--center">
        {qna ? (
          <button type="button" onClick={qna.onRetry} className="quiz-footer-btn quiz-footer-btn--soft">
            <RotateCcw size={13} strokeWidth={2.25} aria-hidden />
            <span>Retry</span>
          </button>
        ) : null}
      </div>

      <div className="quiz-footer-group quiz-footer-group--end">
        {qna && !qna.showAnswer ? (
          <button
            type="button"
            onClick={qna.onCheck}
            disabled={!qna.canCheck}
            className="quiz-footer-btn quiz-footer-btn--primary"
          >
            <span>Check answer</span>
            <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            className="quiz-footer-btn quiz-footer-btn--primary"
          >
            <span>{isLast ? "Results" : "Next"}</span>
            <ChevronRight size={15} strokeWidth={2.25} aria-hidden />
          </button>
        )}
      </div>
    </footer>
  );
}

function Home({
  onLoad,
}: {
  onLoad: (data: QuizData) => void;
}) {
  const [raw, setRaw] = useState(DEFAULT_SAMPLE_JSON);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ title: string; count: number } | null>(() => {
    try {
      const parsed = parseQuizJson(DEFAULT_SAMPLE_JSON);
      return { title: parsed.title, count: parsed.questions.length };
    } catch {
      return null;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const parseAndLoad = useCallback(
    (text: string) => {
      try {
        onLoad(parseQuizJson(text));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not parse JSON.");
      }
    },
    [onLoad]
  );

  const handleChange = (value: string) => {
    setRaw(value);
    if (!value.trim()) {
      setError(null);
      setPreview(null);
      return;
    }
    try {
      const parsed = parseQuizJson(value);
      setPreview({ title: parsed.title, count: parsed.questions.length });
      setError(null);
    } catch {
      setPreview(null);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text");
      if (text?.trim().startsWith("{")) setRaw(text);
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

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CHATGPT_PROMPT_TEMPLATE);
      setError(null);
    } catch {
      setError("Could not copy prompt. ChatGPT will still open with the text filled in.");
    }
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 2000);
    openChatGptWithPrompt(CHATGPT_PROMPT_TEMPLATE);
  };

  return (
    <div
      className="quiz-shell"
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
      <ShellBackground />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className={`home-card ${dragging ? "home-card--dragging" : ""}`}
      >
        <div className="home-card-content">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            Learn Quiz
          </span>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-primary">
          Load a quiz
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Edit the sample below, paste your own JSON, or load a file.
        </p>

        <textarea
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          className="home-textarea mt-4 w-full resize-none rounded-xl px-3 py-2.5 font-mono text-[13px]"
        />

        {preview && !error && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
            <span className="preview-chip">
              <CheckCircle2 className="h-3 w-3" />
              {preview.title} · {preview.count} questions
            </span>
          </motion.div>
        )}

        {error && (
          <p className="mt-2 text-[12px] text-error">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="quiz-secondary-btn flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium"
          >
            <Upload className="h-3.5 w-3.5" />
            Load file
          </button>
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="quiz-secondary-btn flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium"
          >
            <Copy className="h-3.5 w-3.5" />
            {copiedPrompt ? "Opened!" : "ChatGPT prompt"}
          </button>
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

        <button
          type="button"
          disabled={raw.trim().length === 0}
          onClick={() => parseAndLoad(raw)}
          className="quiz-primary-btn mt-3 w-full rounded-full py-2.5 text-[13px] font-semibold"
        >
          Start quiz
        </button>
        </div>
      </motion.div>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getRecordingMimeType(): string | undefined {
  const types = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/aac",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function isTauriApp(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

function useQuestionTimer(questionKey: string, active: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active || !questionKey) return;
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [questionKey, active]);

  return elapsed;
}

function QuizHeader({
  title,
  current,
  total,
  revealed,
  correct,
  elapsedSeconds,
}: {
  title: string;
  current: number;
  total: number;
  revealed: boolean;
  correct: number;
  elapsedSeconds: number;
}) {
  const done = current + (revealed ? 1 : 0);
  const progress = (done / total) * 100;

  return (
    <div className="quiz-header">
      <div className="quiz-header-row">
        <span className="quiz-title-pill">
          {title}
        </span>
        <div
          className="quiz-stats-chip"
          title={`Question ${current + 1} of ${total} · Correct ${correct} · ${formatElapsed(elapsedSeconds)}`}
        >
          <span className="quiz-stats-chip-seg">
            <span className="quiz-stats-chip-label">Q</span>
            <span className="quiz-stats-chip-dash" aria-hidden>
              :
            </span>
            {current + 1}/{total}
          </span>
          <span className="quiz-stats-chip-divider" aria-hidden />
          <span className="quiz-stats-chip-seg quiz-stats-chip-seg--correct">
            {correct}
          </span>
          <span className="quiz-stats-chip-divider" aria-hidden />
          <span className="quiz-stats-chip-seg quiz-stats-chip-seg--timer">
            <Timer className="quiz-stats-chip-icon" aria-hidden />
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
      </div>
      <div className="quiz-progress-track">
        <motion.div
          className="quiz-progress-fill h-full rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function scrollToReveal(el: HTMLElement | null) {
  if (!el) return;
  window.setTimeout(() => {
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }, 120);
}

function QuizQuestionCard({
  q,
  state,
  onSelect,
}: {
  q: QuizQuestion;
  state: QuizAnswerState;
  onSelect: (i: number) => void;
}) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  const isCorrect = state.submitted && state.selected === q.answer;

  useEffect(() => {
    if (state.submitted) scrollToReveal(feedbackRef.current);
  }, [state.submitted]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={q.question}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <p className="quiz-question-text">
          {q.question}
        </p>

        <div className="space-y-2">
          {q.options.map((label, i) => {
            const id = optionId(i);
            const isSelected = state.selected === i;
            const isAnswer = i === q.answer;
            let optionClass = "quiz-option";
            if (state.submitted) {
              if (isAnswer) optionClass += " quiz-option--correct";
              else if (isSelected) optionClass += " quiz-option--wrong";
            } else if (isSelected) {
              optionClass += " quiz-option--selected";
            }

            return (
              <motion.button
                key={id}
                type="button"
                disabled={state.submitted}
                onClick={() => onSelect(i)}
                className={optionClass}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                whileTap={state.submitted ? undefined : { scale: 0.99 }}
              >
                <span className="quiz-option-letter">{id}</span>
                <span className="flex-1 text-left text-[13px] leading-snug">{label}</span>
                {state.submitted && isAnswer && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#10b981" }} />}
                {state.submitted && isSelected && !isAnswer && <XCircle className="h-4 w-4 shrink-0" style={{ color: "#ef4444" }} />}
              </motion.button>
            );
          })}
        </div>

        {state.submitted && (
          <motion.div
            ref={feedbackRef}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`feedback-banner ${isCorrect ? "feedback-banner--correct" : "feedback-banner--wrong"} text-secondary`}
          >
            <p className="text-[13px] leading-relaxed">
              <span className="font-semibold" style={{ color: isCorrect ? "#10b981" : "#ef4444" }}>
                {isCorrect ? "Correct! " : "Not quite. "}
              </span>
              The answer is: {q.options[q.answer]}
            </p>
            {q.explanation && (
              <p className="mt-2 border-t pt-2 text-[13px] leading-relaxed" style={{ borderColor: isCorrect ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)", color: "var(--text-secondary)" }}>
                {q.explanation}
              </p>
            )}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function QnaQuestionCard({
  q,
  state,
  onTextChange,
  onRecordingComplete,
  onClearRecording,
  registerRecordControls,
}: {
  q: QnaQuestion;
  state: QuizAnswerState;
  onTextChange: (text: string) => void;
  onRecordingComplete: (url: string) => void;
  onClearRecording: () => void;
  registerRecordControls: (start: () => void, stop: () => void, isRecording: boolean) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechLive, setSpeechLive] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderMimeRef = useRef<string>("audio/mp4");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const textBaseRef = useRef("");
  const isRecordingRef = useRef(false);
  const textValueRef = useRef(state.text);

  const speechSupported = useMemo(
    () => Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition),
    [],
  );
  const inTauriApp = useMemo(() => isTauriApp(), []);

  useEffect(() => {
    textValueRef.current = state.text;
  }, [state.text]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (state.showAnswer) scrollToReveal(answerRef.current);
  }, [state.showAnswer]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const id = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRecording]);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSpeechLive(false);
      return false;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = document.documentElement.lang || "en-US";

      recognition.onresult = (event) => {
        let spoken = "";
        for (let i = 0; i < event.results.length; i++) {
          spoken += event.results[i][0].transcript;
        }
        const base = textBaseRef.current;
        const trimmed = spoken.trim();
        if (!trimmed) return;
        const needsSpace = base.length > 0 && !/\s$/.test(base);
        onTextChange(`${base}${needsSpace ? " " : ""}${trimmed}`);
        setSpeechLive(true);
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed") {
          setMicError(
            inTauriApp
              ? "Allow Microphone and Speech Recognition for Quiz in System Settings, then restart the app."
              : "Microphone or speech recognition was blocked. Check browser permissions.",
          );
        } else if (event.error !== "aborted" && event.error !== "no-speech") {
          setSpeechLive(false);
        }
      };

      recognition.onend = () => {
        if (!isRecordingRef.current) return;
        try {
          recognition.start();
        } catch {
          // Browser may refuse immediate restart.
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setSpeechLive(true);
      return true;
    } catch {
      setSpeechLive(false);
      return false;
    }
  }, [onTextChange, inTauriApp]);

  const stopSpeechRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setSpeechLive(false);
  }, []);

  const startRecording = useCallback(async () => {
    setMicError(null);
    setSpeechLive(false);
    textBaseRef.current = textValueRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getRecordingMimeType();
      if (!mimeType) {
        stream.getTracks().forEach((tr) => tr.stop());
        setMicError("This browser cannot record audio.");
        return;
      }

      recorderMimeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());

        if (chunksRef.current.length === 0) {
          setMicError("Recording was too short. Hold Record a little longer.");
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorderMimeRef.current });
        if (blob.size === 0) {
          setMicError("Recording was empty. Try again.");
          return;
        }

        revokeBlobUrl(state.audioUrl);
        onRecordingComplete(URL.createObjectURL(blob));
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      startSpeechRecognition();
    } catch {
      setMicError("Microphone access was denied or is unavailable.");
    }
  }, [onRecordingComplete, startSpeechRecognition, state.audioUrl]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      if (recorder.state === "recording") recorder.requestData();
      recorder.stop();
    }
    stopSpeechRecognition();
    setIsRecording(false);
  }, [stopSpeechRecognition]);

  const toggleRecord = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

  const togglePlay = async () => {
    if (!state.audioUrl) return;
    setMicError(null);

    try {
      if (!audioRef.current || audioRef.current.src !== state.audioUrl) {
        audioRef.current?.pause();
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = state.audioUrl;
        audio.onended = () => setPlaying(false);
        audio.onerror = () => {
          setPlaying(false);
          setMicError("Could not play this recording. Try recording again.");
        };
        audioRef.current = audio;
      }

      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
        return;
      }

      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setMicError("Playback failed. Try Chrome/Safari or record again.");
    }
  };

  const clearRecording = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
    revokeBlobUrl(state.audioUrl);
    onClearRecording();
  };

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  }, [state.audioUrl]);

  useEffect(() => {
    registerRecordControls(startRecording, stopRecording, isRecording);
  }, [registerRecordControls, startRecording, stopRecording, isRecording]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      recognitionRef.current?.stop();
      audioRef.current?.pause();
    };
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={q.question}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <div className="theory-qa-section">
          <div className="theory-qa-label mb-2">
            <HelpCircle className="h-3.5 w-3.5 text-accent" />
            <span>Question</span>
          </div>
          <p className="quiz-question-text">
            {q.question}
          </p>
        </div>

        <div className="theory-qa-compose">
          <div className="theory-qa-row flex gap-3">
            <textarea
              value={state.text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder={
                isRecording
                  ? speechLive
                    ? "Speak — your words appear here instantly…"
                    : "Recording audio… type your answer if speech-to-text is unavailable"
                  : "Type your answer here…"
              }
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              className={`theory-qa-input min-h-[clamp(6rem,22vh,12rem)] min-w-0 flex-1 resize-y rounded-xl px-3 py-2.5 text-[13px] leading-relaxed outline-none${isRecording ? " theory-qa-input--recording" : ""}`}
            />

            <div className="theory-voice-panel">
              <button
                type="button"
                onClick={toggleRecord}
                className={`theory-voice-btn ${isRecording ? "theory-voice-btn--recording" : ""}`}
                title={isRecording ? "Stop recording" : "Record answer"}
                aria-pressed={isRecording}
              >
                {isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
              </button>
              <span className="theory-voice-btn-label">{isRecording ? "Stop" : "Record"}</span>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!state.audioUrl || isRecording}
                className="theory-voice-btn"
                title={playing ? "Pause playback" : "Play recording"}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <span className="theory-voice-btn-label">{playing ? "Pause" : "Play"}</span>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="theory-voice-live-banner"
              >
                <div className="theory-voice-live-top">
                  <span className="theory-voice-live-dot" aria-hidden />
                  <span className="theory-voice-live-title">Recording {formatElapsed(recordingSeconds)}</span>
                </div>
                <p className="theory-voice-live-hint">
                  {speechLive
                    ? "Listening — speech is typed into the box instantly as you talk."
                    : speechSupported
                      ? "Starting instant speech recognition…"
                      : inTauriApp
                        ? "Rebuild the Quiz app after updating permissions, then allow Mic + Speech Recognition when prompted."
                        : "Live speech-to-text works best in Chrome or Edge. You can still type your answer."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!isRecording && state.audioUrl && (
            <div className="theory-voice-saved-banner">
              <span className="theory-voice-status theory-voice-status--saved">Recording saved</span>
              <span className="theory-voice-saved-hint">Play to review, edit the text, or record again.</span>
              <button type="button" onClick={clearRecording} className="theory-voice-clear-btn">
                Clear audio
              </button>
            </div>
          )}
        </div>

        {micError && (
          <p className="text-[12px] text-error">
            {micError}
          </p>
        )}

        <AnimatePresence initial={false}>
          {state.showAnswer && (
            <motion.div
              ref={answerRef}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="theory-qa-answer--revealed rounded-xl px-3.5 py-3 text-[13px] leading-relaxed text-secondary"
            >
              <div className="theory-qa-label mb-2">
                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
                <span>Answer</span>
              </div>
              {q.answer}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

function ResultScreen({
  quizData,
  answers,
  onRestart,
  onHome,
}: {
  quizData: QuizData;
  answers: QuizAnswerState[];
  onRestart: () => void;
  onHome: () => void;
}) {
  const quizQuestions = quizData.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.type === "quiz") as { q: QuizQuestion; i: number }[];

  const score = quizQuestions.filter(({ q, i }) => answers[i].selected === q.answer).length;
  const total = quizQuestions.length;
  const pct = total === 0 ? 100 : Math.round((score / total) * 100);
  const qnaCount = quizData.questions.filter((q) => q.type === "qna").length;

  return (
    <div className="quiz-shell">
      <ShellBackground />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="quiz-modal"
      >
        <div className="quiz-body flex min-h-0 flex-1 flex-col items-center justify-center text-center">
          <motion.div
            initial={{ scale: 0.88, rotate: -6 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
            className="result-trophy mb-5"
          >
            <Trophy className="h-8 w-8" />
          </motion.div>

          {total > 0 && <ScoreRing score={score} total={total} />}

          <h3 className="mt-4 text-[20px] font-bold text-primary">
            {total === 0 ? "Quiz complete!" : score === total ? "Perfect score!" : pct >= 60 ? "Well done!" : "Keep practicing!"}
          </h3>
          <p className="mt-2 text-[14px] text-secondary">
            {total > 0 ? (
              <>
                You got <strong className="text-accent">{score}</strong> out of <strong>{total}</strong> MCQ correct
              </>
            ) : (
              <>You finished {quizData.title}</>
            )}
          </p>

          {(total > 0 || qnaCount > 0) && (
            <div className="mt-5 flex w-full max-w-md gap-2">
              {total > 0 && (
                <>
                  <div className="stat-pill">
                    <span className="stat-pill-value stat-pill-value--correct">{score}</span>
                    <span className="stat-pill-label">Correct</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-pill-value stat-pill-value--wrong">{total - score}</span>
                    <span className="stat-pill-label">Wrong</span>
                  </div>
                </>
              )}
              {qnaCount > 0 && (
                <div className="stat-pill">
                  <span className="stat-pill-value stat-pill-value--neutral">{qnaCount}</span>
                  <span className="stat-pill-label">Q&A</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onRestart}
              className="quiz-secondary-btn flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </button>
            <button type="button" onClick={onHome} className="quiz-primary-btn rounded-full px-4 py-2 text-[13px] font-semibold">
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

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
  const [stage, setStage] = useState<Stage>("home");
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswerState[]>([]);

  const recordControls = useRef<{ start: () => void; stop: () => void; isRecording: boolean }>({
    start: () => {},
    stop: () => {},
    isRecording: false,
  });

  const total = quizData?.questions.length ?? 0;
  const currentQ = quizData?.questions[index] ?? null;
  const currentAns = answers[index];

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => applyTheme(media.matches ? "dark" : "light");
    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, []);

  const handleLoad = (data: QuizData) => {
    setQuizData(data);
    setAnswers(makeInitialAnswers(data.questions));
    setIndex(0);
    setStage("quiz");
  };

  const updateAnswer = useCallback((i: number, patch: Partial<QuizAnswerState>) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    if (!quizData) return;
    if (index < total - 1) setIndex((i) => i + 1);
    else setStage("result");
  }, [index, total, quizData]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const selectQuizOption = useCallback(
    (i: number) => {
      if (currentAns?.submitted) return;
      updateAnswer(index, { selected: i, submitted: true });
    },
    [currentAns, index, updateAnswer]
  );

  const revealQna = useCallback(() => {
    updateAnswer(index, { showAnswer: true });
  }, [index, updateAnswer]);

  const retry = useCallback(() => {
    updateAnswer(index, { text: "", audioUrl: null, showAnswer: false });
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

  const qnaCanProceed = useMemo(() => {
    if (!currentAns || currentQ?.type !== "qna") return true;
    return currentAns.showAnswer || currentAns.text.trim().length > 0 || Boolean(currentAns.audioUrl);
  }, [currentAns, currentQ]);

  useEffect(() => {
    if (stage !== "quiz" || !currentQ || !currentAns) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "TEXTAREA" || target.tagName === "INPUT";

      const canGoNext =
        currentQ.type === "quiz" ? currentAns.submitted : currentAns.showAnswer;
      const qnaCanCheck =
        currentQ.type === "qna" &&
        !currentAns.showAnswer &&
        (currentAns.text.trim().length > 0 || Boolean(currentAns.audioUrl));

      if (e.key === "Enter" && !e.shiftKey) {
        if (qnaCanCheck) {
          e.preventDefault();
          revealQna();
          return;
        }
        if (canGoNext) {
          e.preventDefault();
          goNext();
          return;
        }
      }

      if (isTyping) return;

      if (e.key === "ArrowRight" && (currentQ.type !== "quiz" || currentAns.submitted) && qnaCanProceed) goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key.toLowerCase() === "r" && currentQ.type === "qna") retry();
      else if (e.key.toLowerCase() === "s" && currentQ.type === "qna") revealQna();
      else if (e.code === "Space" && currentQ.type === "qna") {
        e.preventDefault();
        if (recordControls.current.isRecording) recordControls.current.stop();
        else recordControls.current.start();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage, currentQ, currentAns, goNext, goPrev, retry, revealQna, qnaCanProceed]);

  const quizRevealed = currentQ?.type === "quiz" && currentAns?.submitted;
  const qnaRevealed = currentQ?.type === "qna" && currentAns?.showAnswer;

  const mcqCorrect = useMemo(() => {
    if (!quizData) return 0;
    return quizData.questions.reduce((count, q, i) => {
      if (q.type !== "quiz") return count;
      if (answers[i]?.submitted && answers[i].selected === q.answer) return count + 1;
      return count;
    }, 0);
  }, [quizData, answers]);

  const questionTimerKey = currentQ ? `${index}:${currentQ.question}` : "";
  const elapsedSeconds = useQuestionTimer(questionTimerKey, stage === "quiz");

  return (
    <>
      {stage === "home" && <Home onLoad={handleLoad} />}

      {stage === "quiz" && quizData && currentQ && currentAns && (
        <div className="quiz-shell">
          <ShellBackground />

          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="quiz-modal"
          >
            <QuizHeader
              title={quizData.title}
              current={index}
              total={total}
              revealed={Boolean(quizRevealed || qnaRevealed)}
              correct={mcqCorrect}
              elapsedSeconds={elapsedSeconds}
            />

            <div className="quiz-body">
              {currentQ.type === "quiz" ? (
                <QuizQuestionCard
                  q={currentQ}
                  state={currentAns}
                  onSelect={selectQuizOption}
                />
              ) : (
                <QnaQuestionCard
                  q={currentQ}
                  state={currentAns}
                  onTextChange={(text) => updateAnswer(index, { text })}
                  onRecordingComplete={(url) => updateAnswer(index, { audioUrl: url })}
                  onClearRecording={() => updateAnswer(index, { audioUrl: null })}
                  registerRecordControls={(start, stop, isRecording) => {
                    recordControls.current = { start, stop, isRecording };
                  }}
                />
              )}
            </div>

            {currentQ.type === "qna" ? (
              <QuizFooter
                index={index}
                total={total}
                canGoNext={currentAns.showAnswer}
                onPrev={goPrev}
                onNext={goNext}
                qna={{
                  showAnswer: currentAns.showAnswer,
                  canCheck: Boolean(currentAns.text.trim() || currentAns.audioUrl),
                  onRetry: retry,
                  onCheck: revealQna,
                }}
              />
            ) : (
              <QuizFooter
                index={index}
                total={total}
                canGoNext={currentAns.submitted}
                onPrev={goPrev}
                onNext={goNext}
              />
            )}
          </motion.div>
        </div>
      )}

      {stage === "result" && quizData && (
        <ResultScreen quizData={quizData} answers={answers} onRestart={restart} onHome={backToHome} />
      )}
    </>
  );
}
