# AI Recruiter – Technical Knowledge Base (Client Ready)

> Export tip: Copy this doc into Google Docs or upload directly to keep headings and lists.

## 1) Product Overview
- AI-led mock interviews with voice-first UX: classic (TTS/STT) and OpenAI Realtime (WebRTC) modes.
- Interview lifecycle: create interview → share short link → live interview (voice) → auto feedback/results.
- Built on Next.js App Router (TypeScript), Tailwind, Convex for data, Clerk auth, and Supabase storage; hardened with Arcjet.

## 2) Core Architecture
- Frontend: Next.js 16 (App Router) + React 19 + Tailwind 4; modular route groups under `app/(routes)` for dashboard, interview start, results, question bank, and realtime demo.
- Backend/API (Next.js edge/server routes):
  - `api/realtime-session` – issues 60s OpenAI Realtime WebRTC tokens.
  - `api/voice-session` (+`/status`, `/end`, `/toggle-mic`) – Twilio voice interview control.
  - `api/elevenlabs/*` – speech-to-text and text-to-speech for classic mode.
  - `api/generate-interview-questions`, `api/interview-feedback` – content + feedback generation.
  - `api/shorten` + `api/validate-shortlink` – short link creation/validation for interviews.
- Data: Convex collections for users, interviews, question bank, conversations, short links; Convex client provider in app shell.
- Auth: Clerk for user/session management; onboarding fixes ensure session activation post-email verification.
- Media/Storage: Supabase (project Admito) for persisted assets; ImageKit for CDN delivery.
- Security/Abuse: Arcjet middleware (`middleware.ts` + `utils/arcjet.ts`) for rate limiting/bot protection; ephemeral tokens for realtime.

## 3) Voice & Realtime Stack
- Classic Mode (default): ElevenLabs TTS/STT + custom audio recorder; VAD-driven auto-start/stop; WAV conversion for reliable STT; animated VoiceAssistant UI.
- Realtime Mode: OpenAI Realtime API over WebRTC (`realtime-webrtc.ts`, `RealtimeVoice.tsx`, `/realtime-demo`); server-side VAD, ultra-low latency (~200–500ms), interruption support, 6 selectable voices; token TTL 60s; instructions built from interview questions.
- Telephony Mode: Twilio voice-only path with `voice-session` endpoints, Twilio Device setup, conference management, recording, and STT/TTS pipeline.
- Voice quality: Enhanced constraints (48kHz, AGC, noise suppression, echo cancel), codec fallbacks, improved silence detector (dual RMS + frequency), watchdog timers for stuck recorders, post-TTS watchdog, WAV validation.
- VAD: Frequency-band analysis (85–3000 Hz), dual confirmation windows, 3s silence timer with smoothing; tunable thresholds to avoid false positives/negatives.

## 4) Interview Experience & Flow
- Live flow: welcome prompt → ask question → auto-mic start after TTS → user speaks → VAD-driven stop → transcription → transition phrase → next question; response timeouts prompt user at 15s+.
- Modes toggle on start page (`interview/[id]/start`): Classic vs Realtime; UI switches between VoiceAssistant and RealtimeVoice.
- Resilience: watchdogs for no-voice, post-TTS mic start, idempotent stopRecording, self-healing MediaRecorder, retries for getUserMedia, WAV conversion on every clip.
- Results: Conversation persisted to Convex; results/feedback pages consume saved transcripts and generated feedback.
- Sharing: `/api/shorten` issues `l/:token` redirectors with expiry/usage limits; start page validates token+autostart and handles expired/used redirects.

## 5) Key Files (by role)
- Voice/Realtime: `app/utils/realtime-webrtc.ts`, `app/components/RealtimeVoice.tsx`, `app/(routes)/realtime-demo/page.tsx`, `app/utils/audio-recorder.ts`, `app/utils/voice-activity-detector.ts`, `app/utils/silence-detector.ts`, `app/components/VoiceTest.tsx`.
- Interview UI/logic: `app/(routes)/interview/[interviewId]/start/page.tsx`, `app/utils/conversation-manager.ts`, `app/(routes)/interview/[interviewId]/results/page.tsx`.
- APIs: `app/api/realtime-session/route.ts`, `app/api/voice-session/*`, `app/api/elevenlabs/*`, `app/api/generate-interview-questions/route.tsx`, `app/api/interview-feedback/route.tsx`, `app/api/shorten/route.ts`, `app/api/validate-shortlink/route.ts`.
- Auth/Onboarding: `app/(auth)/sign-in`, `sign-up`, `onboarding/page.tsx` (session activation fix).
- Config/Infra: `middleware.ts` (Arcjet), `app/config/voice-config.ts` (voice test/debug), `ConvexClientProvider.tsx`.
- Docs: `docs/REALTIME_WEBRTC_INTEGRATION.md`, `REALTIME_INTEGRATION.md` (quick start), `docs/LIVE_INTERVIEW_FLOW.md`, `docs/VOICE_ACTIVITY_DETECTION.md`, `docs/VOICE_QUALITY_IMPROVEMENTS.md`, `INTERVIEW_FIXES_SUMMARY.md`, `SIGNUP_FLOW_FIX.md`.

## 6) Why These Choices
- WebRTC Realtime vs classic STT/TTS: delivers natural, interruptible conversation with sub-second latency; classic kept as cheaper, backward-compatible default.
- Frequency-based VAD: reduces false triggers and mid-sentence cutoffs vs volume thresholds; enables reliable automation without manual controls.
- Ephemeral tokens + Arcjet: protect keys and APIs; limit abuse on realtime session creation and short-link validation.
- WAV conversion and watchdog timers: improve transcription reliability and prevent stuck recorder states, eliminating blank/question stalls.
- Convex: low-latency, reactive data sync for conversations, interviews, and short links without manual API boilerplate.
- Clerk + onboarding fix: ensures session validity immediately after email verification, preventing “is unknown” redirect errors.

## 7) Environment & Secrets (set in `.env.local`)
- Auth: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Data/Storage: Supabase URL/keys; ImageKit `public/private` + endpoint
- Voice/AI: `OPENAI_API_KEY` (classic STT), `OPENAI_REALTIME_API_KEY` (WebRTC), `ELEVENLABS_API_KEY`
- Telephony: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Safety/Risk: `ARCJET_KEY`
- App: `NEXT_PUBLIC_BASE_URL`

## 8) Key Flows (API + Client)
- Realtime mode:
  1) Client POST `/api/realtime-session` → ephemeral token (60s)
  2) Client `RealtimeWebRTC.connect()` → WebRTC SDP exchange with OpenAI
  3) Bidirectional audio/text; `onTranscript` wires into ConversationManager + Convex update
- Classic mode:
  1) TTS via ElevenLabs → play → auto-mic start
  2) Recorder (48kHz, VAD) → WAV → STT → ConversationManager → next question
- Twilio voice-only:
  1) POST `/api/voice-session` to start; TwiML sets up conference
  2) `/status` webhooks manage events; `/end` terminates and triggers feedback
- Short links:
  1) POST `/api/shorten` with interviewId/expiry/uses → token + URL
  2) GET `/l/:token` → validate → redirect to `/interview/:id/start?token=...&autostart=1`

## 9) Testing & Validation
- Realtime: `/realtime-demo` page to exercise connect/mute/transcripts/voice selection; curl `/api/realtime-session`; verify Convex conversation persistence and results rendering.
- Classic: Run full interview (5+ questions); confirm VAD auto-stop at silence, watchdog recovery, WAV conversion success; check feedback page.
- Twilio: Use `VoiceTest` utilities (mic/speaker/Twilio device/network); start/end `/api/voice-session` and confirm cleanup + feedback.
- Auth: Complete sign-up with email verification; ensure immediate session activation and redirect to dashboard after recruiter selection.
- Short links: Create, consume until maxUses/expiry; verify expired/used redirects.

## 10) Operational Notes
- Browser requirements: Modern WebRTC + microphone; HTTPS in prod, localhost ok for dev.
- Cost considerations: Classic ~0.15/min (ElevenLabs + GPT-4o-mini). Realtime ~0.60/min (OpenAI Realtime); keep classic as default to manage spend.
- Observability: Rich console logs in interview flow (timers, VAD events, recorder lifecycle, WAV validation). Realtime client exposes `getStats()` for WebRTC metrics.
- Backward compatibility: Classic flow untouched; Realtime is opt-in; data schemas unchanged.

## 11) Recommended Next Steps
- Add rate limiting on `/api/realtime-session` (Arcjet/Redis) and per-user quotas for cost control.
- Expose voice selection and analytics (mode usage, latency, cost).
- Mobile optimization for Realtime UI and mic permissions.
- Add telemetry around silence detection thresholds to auto-tune VAD.

