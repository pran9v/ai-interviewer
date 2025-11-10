# Race Condition Fixes - Preventing Intertwined AI Responses

## Problem Description

**Issue**: When silence detection was delayed or user spoke multiple answers before the first was processed, multiple recording sessions could overlap. This caused:
- Multiple transcriptions running simultaneously
- AI asking multiple questions at once (intertwined responses)
- Conversation getting out of sync
- User confusion from hearing two AI voices simultaneously

**Root Cause**: No mutex/lock mechanism to prevent:
1. Multiple `askNextQuestion()` calls running concurrently
2. Multiple `stopRecording()` → transcription → `askNextQuestion()` chains
3. Recording starting while AI is still speaking a question

## Solution Implemented

### 1. Question Mutex Lock (`isAskingQuestionRef`)

Added a **ref-based lock** to ensure only ONE AI question can be in progress at a time.

**Flow**:
```
askNextQuestion() called
  ↓
Check: isAskingQuestionRef.current?
  ↓ (if true)
❌ BLOCKED - return early (prevent duplicate)
  ↓ (if false)
✅ Acquire lock (set to true)
  ↓
Speak question via TTS
  ↓
TTS completes
  ↓
Release lock (set to false)
  ↓
User can now respond
```

**Location**: `/app/(routes)/interview/[interviewId]/start/page.tsx`

**Changes**:
```typescript
// Line ~57: Added mutex ref
const isAskingQuestionRef = useRef(false);

// Line ~305: Acquire lock at start
if (isAskingQuestionRef.current) {
    console.warn('⚠️ askNextQuestion: already asking a question, blocking duplicate call');
    return false;
}
isAskingQuestionRef.current = true;
console.log('🔒 askNextQuestion: lock acquired');

// Line ~360: Release lock after TTS completes
isAskingQuestionRef.current = false;
console.log('🔓 askNextQuestion: lock released (TTS complete, user can respond)');

// Line ~367: Release lock on error path
isAskingQuestionRef.current = false;
console.log('🔓 askNextQuestion: lock released (error path)');
```

### 2. Recording Prevention During Question

Prevents recording from starting while AI is still asking the question.

**Guards Added**:

**In `startRecording()`** (Line ~423):
```typescript
// Prevent recording if AI is currently asking a question
if (isAskingQuestionRef.current) {
    console.warn('startRecording: AI is asking question, ignoring recording start');
    return;
}
```

**In `stopRecording()`** (Line ~508):
```typescript
// Prevent processing if AI is currently asking a question
if (isAskingQuestionRef.current) {
    console.warn('stopRecording: AI is asking question, deferring stop until question complete');
    setIsRecording(false);
    setIsStopping(false);
    return;
}
```

### 3. Processing Lock

Prevents multiple transcriptions from running simultaneously.

**In `stopRecording()`** (Line ~515):
```typescript
// Block if already processing another transcription
if (isProcessing) {
    console.warn('stopRecording: already processing a transcription, blocking duplicate');
    setIsRecording(false);
    setIsStopping(false);
    return;
}
```

## How It Prevents Race Conditions

### Scenario 1: User Speaks Multiple Answers Before First Processed

**Before Fix**:
```
User speaks answer 1 → silence detected → stopRecording() starts
  ↓ (while transcribing)
User speaks answer 2 → silence detected → stopRecording() starts AGAIN
  ↓
Two transcriptions running in parallel
  ↓
Two askNextQuestion() calls fire
  ↓
AI asks TWO questions simultaneously (intertwined)
```

**After Fix**:
```
User speaks answer 1 → silence detected → stopRecording() starts
  ↓
isProcessing = true (lock acquired)
  ↓
User speaks answer 2 → silence detected → stopRecording() called
  ↓
❌ BLOCKED (isProcessing = true) → returns early
  ↓
First transcription completes → askNextQuestion()
  ↓
isAskingQuestionRef = true (lock acquired)
  ↓
AI speaks question (single, clean audio)
  ↓
Lock released → ready for next answer
```

### Scenario 2: Delayed Silence Detection

**Before Fix**:
```
AI asks question 1 → silence times out → askNextQuestion(question 2) fires
  ↓
User finally speaks → silence detected → stopRecording()
  ↓
Transcription → askNextQuestion(question 3) fires
  ↓
Now TWO questions playing: question 2 + question 3 (intertwined)
```

**After Fix**:
```
AI asks question 1 → isAskingQuestionRef = true
  ↓
User finally speaks → silence detected → stopRecording() called
  ↓
❌ BLOCKED (isAskingQuestionRef = true) → returns early
  ↓
Question 1 TTS completes → lock released
  ↓
Now ready for user response (clean state)
```

## Console Logging

New logs help diagnose race conditions:

```
🔒 askNextQuestion: lock acquired, transitioning
🔓 askNextQuestion: lock released (TTS complete, user can respond)
⚠️ askNextQuestion: already asking a question, blocking duplicate call
⚠️ startRecording: AI is asking question, ignoring recording start
⚠️ stopRecording: AI is asking question, deferring stop until question complete
⚠️ stopRecording: already processing a transcription, blocking duplicate
```

## State Machine Overview

```
┌─────────────────────────────────────────┐
│  IDLE STATE                             │
│  isAskingQuestion: false                │
│  isRecording: false                     │
│  isProcessing: false                    │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  ASKING QUESTION                        │
│  isAskingQuestion: true ✅ (LOCKED)     │
│  isRecording: false                     │
│  Blocks: startRecording, stopRecording  │
└──────────────┬──────────────────────────┘
               ↓ (TTS finishes)
┌─────────────────────────────────────────┐
│  WAITING FOR RESPONSE                   │
│  isAskingQuestion: false                │
│  isRecording: true (auto-started)       │
│  User can speak                         │
└──────────────┬──────────────────────────┘
               ↓ (3s silence)
┌─────────────────────────────────────────┐
│  PROCESSING ANSWER                      │
│  isProcessing: true ✅ (LOCKED)         │
│  isRecording: false                     │
│  Blocks: duplicate stopRecording        │
└──────────────┬──────────────────────────┘
               ↓ (transcription done)
               │
               └──> ASKING QUESTION (loop)
```

## Testing

### Test Case 1: Rapid Speech
1. Start interview
2. AI asks question
3. Speak answer quickly
4. Immediately speak another answer before transcription finishes
5. **Expected**: Second speech ignored, first answer processed cleanly
6. **Look for**: `⚠️ stopRecording: already processing a transcription, blocking duplicate`

### Test Case 2: Delayed Silence Detection
1. Start interview
2. Wait for silence timeout to trigger
3. Speak while timeout is processing
4. **Expected**: Speech blocked until question finishes
5. **Look for**: `⚠️ stopRecording: AI is asking question, deferring stop`

### Test Case 3: Manual Button Mashing
1. Start interview
2. Rapidly click any buttons multiple times
3. **Expected**: Only one action processed at a time
4. **Look for**: Lock acquisition/release logs

## Files Modified

1. **`/app/(routes)/interview/[interviewId]/start/page.tsx`**
   - Added `isAskingQuestionRef` mutex (line ~57)
   - Lock acquisition in `askNextQuestion()` (line ~305)
   - Lock release after TTS (line ~360, ~367)
   - Guards in `startRecording()` (line ~423)
   - Guards in `stopRecording()` (line ~508, ~515)

## Performance Impact

- **Negligible**: Ref-based locks are instant (no async overhead)
- **Memory**: Single boolean ref (~1 byte)
- **CPU**: Simple boolean checks before expensive operations

## Edge Cases Handled

1. ✅ TTS error during question → Lock still released
2. ✅ Interview complete → Lock released before endInterview()
3. ✅ User closes browser → useEffect cleanup clears locks
4. ✅ Network error during transcription → isProcessing reset in catch block
5. ✅ Multiple silence callbacks → isProcessing blocks duplicates

## Future Improvements

Potential enhancements:
- [ ] Queue system for buffering rapid inputs instead of blocking
- [ ] Timeout on locks (auto-release after 30s if stuck)
- [ ] Visual indicator when action is blocked (subtle UI feedback)
- [ ] Analytics on how often race conditions are prevented

## Troubleshooting

**Problem**: AI not responding after answer
- Check console for: `🔒 askNextQuestion: lock acquired`
- Should see: `🔓 askNextQuestion: lock released` within 10 seconds
- If not released, check for TTS errors

**Problem**: Recording not starting
- Check console for: `⚠️ startRecording: AI is asking question`
- Wait for: `🔓 askNextQuestion: lock released`
- Mic should auto-start 500ms after lock release

**Problem**: Multiple answers not processed
- Check console for: `⚠️ stopRecording: already processing a transcription`
- This is **expected behavior** - only first answer processed
- User should wait for next question before speaking again
