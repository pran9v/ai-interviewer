# Voice Integration Test Scenarios

This document outlines various test scenarios for the voice-only interview system.

## Prerequisites

Before running these tests, ensure:
1. Twilio credentials are properly configured
2. Test mode is enabled in voice-config.ts
3. A working microphone is connected
4. Stable internet connection is available

## Test Scenarios

### 1. Basic Voice Setup Tests

#### Microphone Test
```typescript
// Run the microphone test
const voiceTest = VoiceTestUtils.getInstance();
const micResult = await voiceTest.testMicrophone();
```

**Expected Results:**
- Permission prompt appears for microphone access
- Audio levels are detected when speaking
- Test passes when audio input is confirmed

#### Speaker Test
```typescript
// Run the speaker test
const speakerResult = await voiceTest.testSpeaker();
```

**Expected Results:**
- A test tone is played
- Test passes if audio output is confirmed
- No audio distortion is present

### 2. Connection Tests

#### Twilio Device Setup
```typescript
// Test Twilio device initialization
const deviceResult = await voiceTest.testTwilioDevice();
```

**Expected Results:**
- Twilio Device is initialized successfully
- Connection to Twilio servers is established
- Device events are properly triggered

#### Network Quality Test
```typescript
// Test network conditions
const networkResult = await voiceTest.testNetwork();
```

**Expected Results:**
- Connection to Twilio servers is verified
- Latency is measured
- Test passes if latency is under 300ms

### 3. Interview Flow Tests

#### Start Interview
```typescript
// Test interview start process
const StartConversation = async () => {
    const result = await axios.post('/api/voice-session', {
        knowledge_id: 'test_id'
    });
    // Verify session initialization
};
```

**Expected Results:**
- Voice session is created
- Connection is established
- Interview questions are loaded
- Audio streaming begins

#### End Interview
```typescript
// Test interview end process
const leaveConversation = async () => {
    await axios.post('/api/voice-session/end', {
        knowledge_id: 'test_id'
    });
    // Verify cleanup
};
```

**Expected Results:**
- Session is properly terminated
- Resources are cleaned up
- Feedback is generated
- User is redirected to dashboard

### 4. Error Handling Tests

#### Microphone Access Denied
```typescript
// Test microphone permission denied scenario
navigator.mediaDevices.getUserMedia = async () => {
    throw new Error('NotAllowedError');
};
const micTest = await voiceTest.testMicrophone();
```

**Expected Results:**
- Error is properly caught
- User-friendly error message is displayed
- Recovery suggestions are shown

#### Network Failure
```typescript
// Test network failure scenario
window.fetch = async () => {
    throw new Error('NetworkError');
};
const networkTest = await voiceTest.testNetwork();
```

**Expected Results:**
- Network error is detected
- Error message is displayed
- Retry options are provided

### 5. Audio Quality Tests

#### Background Noise Detection
```typescript
// Test background noise handling
const audioContext = new AudioContext();
const analyzer = audioContext.createAnalyser();
// Monitor audio levels and noise
```

**Expected Results:**
- Background noise levels are measured
- Warning is shown if noise is too high
- Suggestions for noise reduction are provided

#### Voice Clarity Test
```typescript
// Test voice clarity detection
const testAudioQuality = async () => {
    // Analyze audio stream quality
};
```

**Expected Results:**
- Voice clarity is measured
- Feedback on audio quality is provided
- Suggestions for improvement are shown

## Running the Tests

1. **Setup Test Environment**
   ```bash
   # Enable test mode
   export VOICE_TEST_MODE=true
   
   # Start development server
   npm run dev
   ```

2. **Run All Tests**
   ```typescript
   const voiceTest = VoiceTestUtils.getInstance();
   const results = await voiceTest.runAllTests();
   console.log('Test Results:', results);
   ```

3. **Monitor Results**
   - Check browser console for detailed logs
   - Review test results in the UI
   - Verify each test case passes

## Common Issues and Solutions

### 1. Microphone Issues
- **Problem**: Microphone not detected
- **Solution**: Check system settings and browser permissions

### 2. Audio Quality Issues
- **Problem**: Poor audio quality
- **Solution**: Check internet connection and audio settings

### 3. Connection Issues
- **Problem**: Failed to connect to Twilio
- **Solution**: Verify credentials and network connection

## Best Practices for Testing

1. **Test Environment**
   - Use a quiet environment
   - Ensure stable internet connection
   - Use quality audio equipment

2. **Test Data**
   - Use varied test questions
   - Test different interview durations
   - Test with different audio inputs

3. **Error Scenarios**
   - Test all error conditions
   - Verify error messages
   - Test recovery procedures

## Debugging Tips

1. **Enable Debug Mode**
   ```typescript
   // In voice-config.ts
   debug: {
       logLevel: 'debug',
       enableAudioVisualizer: true,
       enableNetworkStats: true
   }
   ```

2. **Monitor Network Traffic**
   - Use browser developer tools
   - Check WebSocket connections
   - Monitor API calls

3. **Audio Debugging**
   - Use audio visualizer
   - Monitor audio levels
   - Check for audio glitches

## Reporting Issues

When reporting issues:
1. Include test results
2. Provide browser console logs
3. Describe steps to reproduce
4. Include environment details
