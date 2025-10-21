export const VOICE_CONFIG = {
    // Test mode configuration
    testMode: process.env.VOICE_TEST_MODE === 'true',
    
    // Twilio configuration
    twilio: {
        // Default test credentials (only used in test mode)
        testCredentials: {
            accountSid: 'AC_test_account_sid',
            authToken: 'test_auth_token',
            phoneNumber: '+1234567890'
        },
        
        // Voice settings
        voice: {
            language: 'en-US',
            voiceName: 'Polly.Joanna', // Default voice
            speechRate: 'medium'
        },
        
        // Audio quality settings
        audio: {
            codec: 'opus',
            sampleRate: 48000,
            channels: 1
        }
    },
    
    // Interview settings
    interview: {
        maxDuration: 3600, // 1 hour in seconds
        questionTimeout: 300, // 5 minutes per question
        silenceThreshold: 2, // 2 seconds of silence to detect end of answer
    },
    
    // Debug settings
    debug: {
        logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
        enableAudioVisualizer: true,
        enableNetworkStats: true,
        enablePerformanceMetrics: true
    }
};
