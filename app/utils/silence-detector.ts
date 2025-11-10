export class SilenceDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private gainNode: GainNode | null = null;
  private silenceStartTime: number | null = null;
  private silenceThreshold = -70; // dB (more sensitive to quiet voices)
  private silenceTimeout = 3000; // 3 seconds for auto-proceed (reduced from 5s)
  private silenceBufferSize = 3; // Reduced buffer for faster detection
  private silenceBuffer: boolean[] = [];
  private isMonitoring = false;
  private onSilenceDetected: () => void;
  private volumeCallback: ((volume: number) => void) | null = null;
  private lastVoiceTime: number = 0; // Track when we last detected voice
  private minVoiceDuration = 500; // Minimum 500ms of voice before considering it valid
  // New tuning parameters
  private minSilenceLevel = 3; // Normalized volume floor (0-100). Increased from 2 to 3 for better detection
  private smoothingWindowMs = 100; // Reduced from 150ms for faster response
  private volumeHistory: number[] = []; // recent normalized volumes for smoothing
  private volumeHistoryMaxLength = 10; // will be recalculated based on smoothingWindowMs
  private hasHeardSpeechSinceStart = false; // tracks if any valid speech occurred in this recording session

  constructor(stream: MediaStream, onSilenceDetected: () => void, opts?: { gain?: number; silenceThreshold?: number; silenceTimeout?: number; minSilenceLevel?: number; smoothingWindowMs?: number }) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 48000 // Match recording sample rate
    });
    this.analyser = this.audioContext.createAnalyser();
    this.onSilenceDetected = onSilenceDetected;

    // Optional tuning
  if (opts?.silenceThreshold !== undefined) this.silenceThreshold = opts.silenceThreshold;
  if (opts?.silenceTimeout !== undefined) this.silenceTimeout = opts.silenceTimeout;
  if (opts?.minSilenceLevel !== undefined) this.minSilenceLevel = opts.minSilenceLevel;
  if (opts?.smoothingWindowMs !== undefined) this.smoothingWindowMs = opts.smoothingWindowMs;
  // Approximate number of animation frames (~16ms each) covering smoothingWindowMs
  this.volumeHistoryMaxLength = Math.max(3, Math.min(50, Math.round(this.smoothingWindowMs / 16)));

    const source = this.audioContext.createMediaStreamSource(stream);

    // Insert a small gain node to boost weak microphones so the analyser sees a stronger signal.
    // Default gain is 1.8 (tunable). This helps when users have very quiet mics.
    const gainVal = opts?.gain ?? 2.5;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = gainVal;
    source.connect(this.gainNode);
    this.gainNode.connect(this.analyser);

    // Enhanced analyser settings for better voice detection
    this.analyser.fftSize = 4096; // Higher FFT size for better frequency resolution
    this.analyser.smoothingTimeConstant = 0.3; // Less smoothing for more responsive detection
    this.analyser.minDecibels = -90; // Lower minimum for better sensitivity
    this.analyser.maxDecibels = -10; // Adjusted max for voice range

    this.startMonitoring();
  }

  setVolumeCallback(callback: (volume: number) => void) {
    this.volumeCallback = callback;
  }

  private startMonitoring() {
    this.isMonitoring = true;
    const bufferLength = this.analyser.frequencyBinCount;
    const frequencyData = new Float32Array(bufferLength);
    const timeData = new Uint8Array(this.analyser.fftSize);
    const smoothingFactor = 0.2; // More smoothing for stability
    let smoothedAverage = 0;
    let peakVolume = 0;
    let voiceDetected = false;
    let voiceStartTime = 0;
    
    const checkSilence = () => {
      if (!this.analyser || !this.isMonitoring) return;

      // Get both frequency and time domain data for better voice detection
      this.analyser.getFloatFrequencyData(frequencyData);
      this.analyser.getByteTimeDomainData(timeData);
      
      // Calculate RMS (Root Mean Square) from time domain for more accurate volume
      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i++) {
        const normalized = (timeData[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / timeData.length);
      const volumeDb = 20 * Math.log10(rms + 0.0001); // Convert to dB
      
      // Also check frequency domain for voice range (300-3400 Hz) - more sensitive
      const voiceRangeStart = Math.floor(200 * bufferLength / (this.audioContext.sampleRate / 2)); // Lower start
      const voiceRangeEnd = Math.floor(4000 * bufferLength / (this.audioContext.sampleRate / 2)); // Higher end
      let voiceRangeSum = 0;
      let voiceRangeCount = 0;
      
      for (let i = voiceRangeStart; i < voiceRangeEnd && i < bufferLength; i++) {
        voiceRangeSum += frequencyData[i];
        voiceRangeCount++;
      }
      const voiceRangeAverage = voiceRangeCount > 0 ? voiceRangeSum / voiceRangeCount : -90;
      
      // Use the higher of the two (RMS or voice range) for better detection
      const instantAverage = Math.max(volumeDb, voiceRangeAverage);
      smoothedAverage = smoothedAverage * (1 - smoothingFactor) + instantAverage * smoothingFactor;
      
      // Track peak volume for visualization and detection
      peakVolume = Math.max(peakVolume, smoothedAverage);
      
      // Update volume callback for visualization
      // Normalize volume to 0-100
      const normalizedVolume = Math.max(0, Math.min(100, (smoothedAverage + 85) * (100 / 65)));

      // Maintain short smoothing buffer for normalized volume
      this.volumeHistory.push(normalizedVolume);
      if (this.volumeHistory.length > this.volumeHistoryMaxLength) {
        this.volumeHistory.shift();
      }
      const smoothedNormalizedVolume = this.volumeHistory.reduce((a, b) => a + b, 0) / this.volumeHistory.length;

      if (this.volumeCallback) {
        this.volumeCallback(smoothedNormalizedVolume);
      }
      
      // Detect voice - more sensitive threshold
      const voiceThreshold = this.silenceThreshold - 10; // -70dB for voice detection
  const isVoiceDetected = smoothedAverage > voiceThreshold;
      
      if (isVoiceDetected) {
        if (!voiceDetected) {
          voiceStartTime = Date.now();
          voiceDetected = true;
          console.log('🎤 VOICE STARTED');
        }
        this.lastVoiceTime = Date.now();
        this.hasHeardSpeechSinceStart = true;
        // Reset silence timer if we detect voice
        if (this.silenceStartTime) {
          console.log('🎤 Voice detected - resetting silence timer', { smoothedAverage, threshold: voiceThreshold });
          this.silenceStartTime = null;
        }
        // Clear silence buffer when voice is detected
        this.silenceBuffer = [];
      } else {
        // Only consider it not voice if we've had enough time without voice
        if (voiceDetected && Date.now() - voiceStartTime < this.minVoiceDuration) {
          // Still in voice detection window, keep it as voice
        } else {
          voiceDetected = false;
        }
      }
      
      // Only check for silence if we're not currently detecting voice
      if (!voiceDetected && Date.now() - this.lastVoiceTime > 1000) {
        // Use a more conservative threshold for silence detection
        const adaptiveThreshold = peakVolume > -50 ? this.silenceThreshold - 3 : this.silenceThreshold;
        // Determine silent frame by dB threshold OR absolute normalized volume floor
        const silentFrame = (smoothedAverage < adaptiveThreshold) || (smoothedNormalizedVolume <= this.minSilenceLevel);
        this.silenceBuffer.push(silentFrame);
        if (this.silenceBuffer.length > this.silenceBufferSize) {
          this.silenceBuffer.shift();
        }
        
        // Check if we have enough consecutive silence readings
  const isSilent = this.silenceBuffer.length === this.silenceBufferSize && 
      this.silenceBuffer.every(value => value);
        
        if (isSilent) {
          if (!this.silenceStartTime) {
            this.silenceStartTime = Date.now();
            console.log('🔇 SILENCE STARTED - will auto-proceed in 3 seconds', { smoothedAverage, threshold: adaptiveThreshold, peakVolume, lastVoiceTime: this.lastVoiceTime });
          } else {
            const elapsed = Date.now() - this.silenceStartTime;
            if (elapsed >= this.silenceTimeout) {
              console.log('✅ SILENCE TIMEOUT REACHED - AUTO-PROCEEDING NOW!', { 
                duration: elapsed,
                average: smoothedAverage,
                peakVolume,
                timeSinceLastVoice: Date.now() - this.lastVoiceTime
              });
              this.onSilenceDetected();
              this.silenceStartTime = null;
              this.silenceBuffer = [];
              peakVolume = 0; // Reset peak
              return;
            } else {
              // Log progress every second
              if (Math.floor(elapsed / 1000) !== Math.floor((elapsed - 100) / 1000)) {
                console.log(`⏱️ Silence: ${Math.floor(elapsed / 1000)}s / 3s`);
              }
            }
          }
        } else {
          if (this.silenceStartTime) {
            console.log('❌ Silence broken', { smoothedAverage, threshold: adaptiveThreshold });
          }
          this.silenceStartTime = null;
        }
      }
      
      requestAnimationFrame(checkSilence);
    };

    checkSilence();
  }

  public cleanup() {
    this.isMonitoring = false;
    this.silenceBuffer = [];
    this.silenceStartTime = null;
    this.volumeHistory = [];
    this.hasHeardSpeechSinceStart = false;
    try {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
    } catch (err) {
      console.warn('Error closing audioContext in SilenceDetector', err);
    }
    this.gainNode = null;
  }
}