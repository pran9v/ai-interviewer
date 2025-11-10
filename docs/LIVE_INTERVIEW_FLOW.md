# Live Interview Flow Implementation

## Overview
This document describes the implementation of a natural, live interview flow where the AI interviewer actively engages with the candidate, similar to a real-time conversation.

## Key Features

### 1. **Automatic Recording After AI Speaks**
- When the AI finishes speaking a question, recording automatically starts after a 500ms pause
- No manual intervention needed - the interview flows naturally

### 2. **Response Timeout Detection**
- If the user doesn't respond within 15 seconds, the AI prompts them with encouraging messages
- Different prompts based on wait time:
  - 0-20 seconds: "I'm waiting for your response. Please go ahead and answer."
  - 20-30 seconds: "Feel free to share your answer whenever you're ready."
  - 30+ seconds: "Take your time, but I'd like to hear your thoughts on this."

### 3. **Natural Question Transitions**
- After each user response, the AI uses a transition phrase before asking the next question
- Examples: "Thank you for that answer.", "I appreciate your response.", "That's helpful, thank you."
- Makes the conversation feel more natural and less robotic

### 4. **Welcome Message**
- Interview starts with a welcome message: "Welcome to your interview. Let's begin with the first question."
- Sets a professional and friendly tone

## Flow Diagram

```
1. User clicks "Start Interview"
   ↓
2. AI speaks welcome message
   ↓
3. AI asks first question
   ↓
4. AI finishes speaking → Auto-start recording (after 500ms)
   ↓
5. User speaks their answer
   ↓
6. Silence detected (7.5s) OR user manually stops recording
   ↓
7. Audio transcribed
   ↓
8. AI says transition phrase + next question
   ↓
9. Repeat from step 4 until all questions are asked
   ↓
10. Interview complete → Generate feedback
```

## Implementation Details

### ConversationManager Enhancements

**New Methods:**
- `isWaitingForResponse()`: Tracks if we're waiting for user response
- `getPromptForNoResponse()`: Returns appropriate prompt based on wait time
- `getTransitionPhrase()`: Returns random transition phrase for natural flow
- `getTimeSinceLastQuestion()`: Returns time elapsed since last question

**State Tracking:**
- `waitingForResponse`: Boolean flag tracking response state
- `lastQuestionTime`: Timestamp of when last question was asked

### Interview Page Updates

**New State Variables:**
- `isSpeaking`: Tracks when AI is actively speaking
- `responseTimeoutRef`: Reference for response timeout
- `promptTimeoutRef`: Reference for prompt timeout

**Enhanced Functions:**

1. **`speakText()`**: 
   - Now accepts optional `onComplete` callback
   - Automatically triggers when audio finishes playing
   - Sets `isSpeaking` state for UI feedback

2. **`askNextQuestion()`**:
   - Accepts `useTransition` parameter
   - Adds transition phrases between questions
   - Auto-starts recording after AI finishes speaking
   - Sets up response timeout monitoring

3. **`setupResponseTimeout()`**:
   - Monitors if user hasn't responded in 15 seconds
   - Prompts user with encouraging message
   - Restarts recording if still no response

4. **`stopRecording()`**:
   - Clears timeouts when user responds
   - Automatically moves to next question with transition
   - Handles retry logic if transcription fails

5. **`startInterviewSession()`**:
   - Starts with welcome message
   - Then asks first question naturally

## User Experience Improvements

### Visual Feedback
- **Blue pulsing text**: "🎤 Interviewer is speaking..."
- **Red pulsing text**: "🔴 Recording your response... Speak now!"
- **Yellow text**: "⏳ Waiting for your response..."

### Automatic Flow
- No need to manually start/stop recording
- Interview progresses naturally like a real conversation
- AI actively engages when user is silent

### Error Handling
- If no speech detected, automatically retries recording
- If transcription fails, offers text input fallback
- Graceful handling of API quota issues

## Configuration

### Timeouts
- **Auto-record delay**: 500ms after AI finishes speaking
- **Response prompt timeout**: 15 seconds
- **Silence detection**: 7.5 seconds (existing)

### Prompts
All prompts are configurable in `ConversationManager.getPromptForNoResponse()`

### Transitions
Transition phrases are randomized from a pool in `ConversationManager.getTransitionPhrase()`

## Testing Recommendations

1. **Test automatic recording**: Verify recording starts after AI finishes speaking
2. **Test timeout prompts**: Wait 15+ seconds without responding to see prompt
3. **Test transitions**: Verify transition phrases appear between questions
4. **Test error recovery**: Test behavior when no speech is detected
5. **Test complete flow**: Run through full interview to verify natural progression

## Future Enhancements

1. **Adaptive timeouts**: Adjust timeout based on question complexity
2. **Follow-up questions**: AI can ask follow-ups based on user responses
3. **Emotional tone**: Adjust AI tone based on interview progress
4. **Real-time feedback**: Provide subtle feedback during responses
5. **Conversation context**: Use previous answers to inform next questions

