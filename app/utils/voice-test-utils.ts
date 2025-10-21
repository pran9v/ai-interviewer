import { Device } from 'twilio-client';
import { VOICE_CONFIG } from '../config/voice-config';

export class VoiceTestUtils {
    private static instance: VoiceTestUtils;
    private audioContext: AudioContext | null = null;
    private testTone: OscillatorNode | null = null;
    private audioAnalyzer: AnalyserNode | null = null;

    private constructor() {
        if (typeof window !== 'undefined') {
            this.audioContext = new AudioContext();
        }
    }

    public static getInstance(): VoiceTestUtils {
        if (!VoiceTestUtils.instance) {
            VoiceTestUtils.instance = new VoiceTestUtils();
        }
        return VoiceTestUtils.instance;
    }

    /**
     * Test microphone input levels
     * @returns Promise<boolean> - true if microphone is working
     */
    public async testMicrophone(): Promise<boolean> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (this.audioContext) {
                const source = this.audioContext.createMediaStreamSource(stream);
                this.audioAnalyzer = this.audioContext.createAnalyser();
                source.connect(this.audioAnalyzer);
                
                // Check audio levels
                const dataArray = new Uint8Array(this.audioAnalyzer.frequencyBinCount);
                this.audioAnalyzer.getByteFrequencyData(dataArray);
                
                // Clean up
                stream.getTracks().forEach(track => track.stop());
                return dataArray.some(level => level > 0);
            }
            return false;
        } catch (error) {
            console.error('Microphone test failed:', error);
            return false;
        }
    }

    /**
     * Test speaker output
     * @returns Promise<boolean> - true if test tone was played
     */
    public async testSpeaker(): Promise<boolean> {
        try {
            if (this.audioContext) {
                this.testTone = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                // Configure test tone
                this.testTone.type = 'sine';
                this.testTone.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4 note
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime); // Low volume
                
                // Connect and play test tone
                this.testTone.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                this.testTone.start();
                
                // Play for 1 second
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.testTone.stop();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Speaker test failed:', error);
            return false;
        }
    }

    /**
     * Test Twilio Device setup
     * @returns Promise<boolean> - true if Twilio Device was initialized successfully
     */
    public async testTwilioDevice(): Promise<boolean> {
        try {
            if (VOICE_CONFIG.testMode) {
                const device = new Device();
                await device.setup('test_token', {
                    debug: true,
                    warnings: true,
                    enableRingingState: true,
                });
                
                // Test device events
                const events = ['ready', 'error', 'disconnect'];
                const eventPromises = events.map(event => 
                    new Promise(resolve => device.once(event, resolve))
                );
                
                // Clean up
                device.destroy();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Twilio Device test failed:', error);
            return false;
        }
    }

    /**
     * Test network connectivity
     * @returns Promise<boolean> - true if network is suitable for voice calls
     */
    public async testNetwork(): Promise<boolean> {
        try {
            // Test connection to Twilio servers
            const response = await fetch('https://www.twilio.com/health');
            if (!response.ok) {
                throw new Error('Failed to connect to Twilio');
            }

            // Test network speed
            const startTime = performance.now();
            await fetch('https://www.twilio.com/favicon.ico');
            const endTime = performance.now();
            const latency = endTime - startTime;

            // Latency should be under 300ms for good voice quality
            return latency < 300;
        } catch (error) {
            console.error('Network test failed:', error);
            return false;
        }
    }

    /**
     * Run all voice tests
     * @returns Promise<Record<string, boolean>> - test results
     */
    public async runAllTests(): Promise<Record<string, boolean>> {
        return {
            microphone: await this.testMicrophone(),
            speaker: await this.testSpeaker(),
            twilioDevice: await this.testTwilioDevice(),
            network: await this.testNetwork()
        };
    }

    /**
     * Clean up resources
     */
    public cleanup(): void {
        if (this.testTone) {
            this.testTone.stop();
            this.testTone.disconnect();
        }
        if (this.audioAnalyzer) {
            this.audioAnalyzer.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}
