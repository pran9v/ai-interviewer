/**
 * Advanced Voice Activity Detector using Web Audio API frequency analysis
 * Analyzes audio spectrum to distinguish speech from silence/noise
 */

export interface VADConfig {
  /** Minimum energy level to consider as speech (0-255) */
  energyThreshold?: number;
  /** Frequency range for human voice (Hz) */
  voiceFrequencyMin?: number;
  voiceFrequencyMax?: number;
  /** Number of consecutive silent frames before triggering silence */
  silenceFrames?: number;
  /** Number of consecutive voice frames before triggering speech */
  speechFrames?: number;
  /** How often to analyze (ms) */
  analyzeInterval?: number;
  /** Silence duration before auto-stop (ms) */
  silenceDuration?: number;
}

export class VoiceActivityDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private source: MediaStreamAudioSourceNode | null = null;
  private rafId: number | null = null;
  
  private energyThreshold: number;
  private voiceFrequencyMin: number;
  private voiceFrequencyMax: number;
  private silenceFrames: number;
  private speechFrames: number;
  private silenceDuration: number;
  
  private consecutiveSilentFrames = 0;
  private consecutiveSpeechFrames = 0;
  private isSpeaking = false;
  private silenceStartTime: number | null = null;
  private hasDetectedSpeech = false;
  
  private onSpeechStart?: () => void;
  private onSpeechEnd?: () => void;
  private onSilenceDetected?: () => void;
  private onVolumeUpdate?: (volume: number) => void;

  constructor(stream: MediaStream, config: VADConfig = {}) {
    // Default config optimized for speech detection
    this.energyThreshold = config.energyThreshold ?? 40; // 0-255 scale
    this.voiceFrequencyMin = config.voiceFrequencyMin ?? 85; // Hz - human voice starts around 85Hz
    this.voiceFrequencyMax = config.voiceFrequencyMax ?? 3000; // Hz - most speech energy is below 3kHz
    this.silenceFrames = config.silenceFrames ?? 8; // ~250ms at 30fps
    this.speechFrames = config.speechFrames ?? 3; // ~100ms at 30fps
    this.silenceDuration = config.silenceDuration ?? 3000; // 3 seconds
    
    // Create audio context with optimal settings
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 48000,
      latencyHint: 'interactive'
    });
    
    // Create analyser with high resolution
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048; // Higher FFT for better frequency resolution
    this.analyser.smoothingTimeConstant = 0.2; // Less smoothing for responsive detection
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    
    // Connect stream
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    
    console.log('VAD: Initialized with config:', {
      energyThreshold: this.energyThreshold,
      voiceFrequency: `${this.voiceFrequencyMin}-${this.voiceFrequencyMax}Hz`,
      silenceDuration: `${this.silenceDuration}ms`
    });
    
    this.startAnalysis();
  }

  setCallbacks(callbacks: {
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
    onSilenceDetected?: () => void;
    onVolumeUpdate?: (volume: number) => void;
  }) {
    this.onSpeechStart = callbacks.onSpeechStart;
    this.onSpeechEnd = callbacks.onSpeechEnd;
    this.onSilenceDetected = callbacks.onSilenceDetected;
    this.onVolumeUpdate = callbacks.onVolumeUpdate;
  }

  private startAnalysis() {
    const bufferLength = this.analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(this.analyser.fftSize);
    
    const analyze = () => {
      if (!this.analyser) return;
      
      // Get frequency and time domain data
      this.analyser.getByteFrequencyData(frequencyData);
      this.analyser.getByteTimeDomainData(timeData);
      
      // Calculate voice frequency range indices
      const sampleRate = this.audioContext.sampleRate;
      const nyquist = sampleRate / 2;
      const freqPerBin = nyquist / bufferLength;
      
      const minBin = Math.floor(this.voiceFrequencyMin / freqPerBin);
      const maxBin = Math.floor(this.voiceFrequencyMax / freqPerBin);
      
      // Calculate energy in voice frequency range
      let voiceEnergy = 0;
      let voiceEnergyCount = 0;
      for (let i = minBin; i < maxBin && i < bufferLength; i++) {
        voiceEnergy += frequencyData[i];
        voiceEnergyCount++;
      }
      const avgVoiceEnergy = voiceEnergyCount > 0 ? voiceEnergy / voiceEnergyCount : 0;
      
      // Calculate RMS from time domain for overall volume
      let rmsSum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const normalized = (timeData[i] - 128) / 128;
        rmsSum += normalized * normalized;
      }
      const rms = Math.sqrt(rmsSum / timeData.length);
      const volumePercent = Math.min(100, rms * 200); // 0-100 scale
      
      // Report volume for visualization
      if (this.onVolumeUpdate) {
        this.onVolumeUpdate(volumePercent);
      }
      
      // Determine if voice is present based on energy in voice frequency range
      const isVoicePresent = avgVoiceEnergy > this.energyThreshold;
      
      if (isVoicePresent) {
        this.consecutiveSpeechFrames++;
        this.consecutiveSilentFrames = 0;
        
        // Trigger speech start if we have enough consecutive speech frames
        if (!this.isSpeaking && this.consecutiveSpeechFrames >= this.speechFrames) {
          this.isSpeaking = true;
          this.hasDetectedSpeech = true;
          this.silenceStartTime = null;
          console.log('🎤 VAD: Speech started', { avgVoiceEnergy, volumePercent: volumePercent.toFixed(1) });
          this.onSpeechStart?.();
        }
      } else {
        this.consecutiveSilentFrames++;
        this.consecutiveSpeechFrames = 0;
        
        // Trigger speech end if we have enough consecutive silent frames
        if (this.isSpeaking && this.consecutiveSilentFrames >= this.silenceFrames) {
          this.isSpeaking = false;
          console.log('🔇 VAD: Speech ended', { avgVoiceEnergy, volumePercent: volumePercent.toFixed(1) });
          this.onSpeechEnd?.();
          
          // Start silence timer
          if (!this.silenceStartTime) {
            this.silenceStartTime = Date.now();
            console.log('⏱️ VAD: Silence timer started');
          }
        }
        
        // Check silence duration
        if (this.silenceStartTime && this.hasDetectedSpeech) {
          const silenceDuration = Date.now() - this.silenceStartTime;
          
          // Log progress every second
          const currentSecond = Math.floor(silenceDuration / 1000);
          const totalSeconds = Math.floor(this.silenceDuration / 1000);
          if (currentSecond > 0 && silenceDuration % 1000 < 50) {
            console.log(`⏱️ VAD: Silence ${currentSecond}s / ${totalSeconds}s`);
          }
          
          if (silenceDuration >= this.silenceDuration) {
            console.log('✅ VAD: Silence duration reached - triggering callback');
            this.silenceStartTime = null;
            this.hasDetectedSpeech = false; // Reset for next recording
            this.onSilenceDetected?.();
            return; // Stop analyzing after silence detected
          }
        }
      }
      
      this.rafId = requestAnimationFrame(analyze);
    };
    
    analyze();
  }

  cleanup() {
    console.log('VAD: Cleanup called');
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (err) {
        console.warn('VAD: Error disconnecting source:', err);
      }
      this.source = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (err) {
        console.warn('VAD: Error closing audio context:', err);
      }
    }
    
    // Reset state
    this.consecutiveSilentFrames = 0;
    this.consecutiveSpeechFrames = 0;
    this.isSpeaking = false;
    this.silenceStartTime = null;
    this.hasDetectedSpeech = false;
    
    console.log('VAD: Cleanup complete');
  }

  // Public getters
  getSpeakingState(): boolean {
    return this.isSpeaking;
  }

  hasHeardSpeech(): boolean {
    return this.hasDetectedSpeech;
  }
}
