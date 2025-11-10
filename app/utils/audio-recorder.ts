import { SilenceDetector } from './silence-detector';
import { VADDetector, VADState } from './vad-detector';
import { VoiceActivityDetector } from './voice-activity-detector';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private silenceDetector: SilenceDetector | null = null;
  private vadDetector: VADDetector | null = null;
  private voiceActivityDetector: VoiceActivityDetector | null = null; // NEW: Advanced VAD
  private onSilenceDetected: (() => void) | null = null;
  private onVolumeUpdate: ((volume: number) => void) | null = null;
  private onSpeechStart: (() => void) | null = null; // NEW
  private onSpeechEnd: (() => void) | null = null; // NEW
  private recordingStartTime: number | null = null; // Track recording start time
  private minRecordingDurationMs = 500; // Minimum 500ms to avoid corrupted files

  // VAD silence timer settings
  private vadSilenceTimeoutMs = 7500; // 7.5s
  private vadSilenceStart: number | null = null;

  setOnSilenceDetected(callback: () => void) {
    this.onSilenceDetected = callback;
  }

  setOnVolumeUpdate(callback: (volume: number) => void) {
    this.onVolumeUpdate = callback;
  }

  setOnSpeechStart(callback: () => void) {
    this.onSpeechStart = callback;
  }

  setOnSpeechEnd(callback: () => void) {
    this.onSpeechEnd = callback;
  }

  // Robust getUserMedia with retries and permission handling
  private async getUserMediaWithRetry(constraints: MediaStreamConstraints, maxAttempts = 3, delayMs = 500): Promise<MediaStream> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`AudioRecorder: getUserMedia attempt ${attempt}/${maxAttempts}`);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('AudioRecorder: obtained media stream', stream.getAudioTracks().map(t => ({ id: t.id, enabled: t.enabled })));
        return stream;
      } catch (err: any) {
        console.error(`AudioRecorder: getUserMedia attempt ${attempt} failed:`, err);
        
        // Check for specific errors
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
        }
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        }
        if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          // Device in use or hardware error - retry after delay
          if (attempt < maxAttempts) {
            console.warn(`AudioRecorder: device busy/error, retrying in ${delayMs}ms...`);
            await new Promise(res => setTimeout(res, delayMs));
            continue;
          }
          throw new Error('Microphone is busy or unavailable. Please close other applications using the microphone.');
        }
        
        // Generic error - retry if attempts remain
        if (attempt < maxAttempts) {
          await new Promise(res => setTimeout(res, delayMs));
          continue;
        }
        throw new Error(`Failed to access microphone: ${err.message || err.name || 'Unknown error'}`);
      }
    }
    throw new Error('Failed to access microphone after multiple attempts');
  }

  async startRecording(): Promise<void> {
    try {
      // Enhanced audio constraints for better voice quality
  const audioConstraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Automatically adjust microphone gain
          sampleRate: 48000 as any, // Higher sample rate for better quality
          channelCount: 1 as any, // Mono for voice
          // @ts-ignore - Chrome-specific constraints
          googEchoCancellation: true,
          googNoiseSuppression: true,
          googAutoGainControl: true,
          googHighpassFilter: true, // Filter out low-frequency noise
          googTypingNoiseDetection: true, // Detect typing sounds
          googNoiseReduction: true
        }
      };

      this.stream = await this.getUserMediaWithRetry(audioConstraints);
      console.log('AudioRecorder: media stream ready');

      // Try to get the best available codec
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];

      let selectedMimeType = 'audio/webm;codecs=opus';
      for (const mimeType of mimeTypes) {
        if ((MediaRecorder as any).isTypeSupported && (MediaRecorder as any).isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      // Create MediaRecorder with robust event binding
      this.createMediaRecorder(this.stream, selectedMimeType);
      
      // Track start time for duration validation
      this.recordingStartTime = Date.now();
      
      // Start with smaller intervals for better quality capture
      this.mediaRecorder!.start(50); // Collect data every 50ms for smoother capture
      console.log('AudioRecorder: MediaRecorder started with 50ms timeslice');      
      
      // Initialize new Voice Activity Detector for robust silence detection
      if (this.onSilenceDetected && this.stream) {
        this.voiceActivityDetector = new VoiceActivityDetector(this.stream, {
          energyThreshold: 40, // Speech energy threshold (0-255)
          voiceFrequencyMin: 85, // Human voice starts ~85Hz
          voiceFrequencyMax: 3000, // Most speech energy below 3kHz
          silenceFrames: 8, // ~250ms of silence to confirm silence
          speechFrames: 3, // ~100ms of speech to confirm speech
          silenceDuration: 3000 // 3 seconds of silence triggers callback
        });
        
        this.voiceActivityDetector.setCallbacks({
          onSilenceDetected: this.onSilenceDetected,
          onVolumeUpdate: this.onVolumeUpdate || undefined,
          onSpeechStart: this.onSpeechStart || undefined,
          onSpeechEnd: this.onSpeechEnd || undefined
        });
        
        console.log('AudioRecorder: VoiceActivityDetector initialized');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error instanceof Error ? error : new Error('Failed to start recording. Please check microphone permissions.');
    }
  }

  // Create and bind MediaRecorder with robust event handling
  private createMediaRecorder(stream: MediaStream, mimeType: string): void {
    try {
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // Higher bitrate for better quality
      });

      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log('AudioRecorder: chunk received, size:', event.data.size, 'total chunks:', this.audioChunks.length);
        } else {
          console.warn('AudioRecorder: received empty chunk');
        }
      };

      this.mediaRecorder.onerror = (event: any) => {
        console.error('AudioRecorder: MediaRecorder error:', event);
        // Try to recover by recreating the recorder
        if (this.stream && this.mediaRecorder) {
          console.warn('AudioRecorder: attempting to recreate MediaRecorder after error');
          try {
            this.createMediaRecorder(this.stream, mimeType);
            this.mediaRecorder!.start(50);
          } catch (err) {
            console.error('AudioRecorder: failed to recreate MediaRecorder:', err);
          }
        }
      };

      console.log('AudioRecorder: MediaRecorder created with mimeType:', mimeType);
    } catch (error) {
      console.error('AudioRecorder: failed to create MediaRecorder:', error);
      throw new Error('Failed to create audio recorder. Your browser may not support audio recording.');
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        console.error('stopRecording: No active MediaRecorder');
        reject(new Error('No active recording'));
        return;
      }

      if (this.mediaRecorder.state === 'inactive') {
        console.warn('stopRecording: MediaRecorder already inactive');
        // If already stopped, return accumulated chunks if any
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
          console.log('stopRecording: returning existing chunks, size:', audioBlob.size);
          this.cleanup();
          resolve(audioBlob);
        } else {
          reject(new Error('No audio data recorded'));
        }
        return;
      }

      console.log('stopRecording: MediaRecorder state:', this.mediaRecorder.state, 'chunks:', this.audioChunks.length);

      // Check minimum recording duration
      const recordingDuration = this.recordingStartTime ? Date.now() - this.recordingStartTime : 0;
      console.log('stopRecording: recording duration:', recordingDuration, 'ms');
      
      if (recordingDuration < this.minRecordingDurationMs) {
        console.warn('stopRecording: recording too short, may be corrupted:', recordingDuration, 'ms');
        // Still proceed but log warning - the blob size check will catch if it's actually corrupted
      }

      // Request final data flush before stopping
      if (this.mediaRecorder.state === 'recording') {
        console.log('stopRecording: requesting final data flush');
        this.mediaRecorder.requestData();
      }

      // Set a safety timeout to ensure we always resolve/reject
      const safetyTimeout = setTimeout(() => {
        console.error('stopRecording: onstop did not fire within 5s, forcing resolution');
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
          console.log('stopRecording: safety timeout - returning partial chunks, size:', audioBlob.size);
          this.cleanup();
          resolve(audioBlob);
        } else {
          this.cleanup();
          reject(new Error('No audio data recorded (timeout)'));
        }
      }, 5000);

      this.mediaRecorder.onstop = () => {
        clearTimeout(safetyTimeout);
        console.log('stopRecording: onstop fired, chunks:', this.audioChunks.length);
        
        // Wait a brief moment for any final ondataavailable events
        setTimeout(() => {
          console.log('stopRecording: final chunk count after delay:', this.audioChunks.length);
          
          if (this.audioChunks.length === 0) {
            console.error('stopRecording: No audio chunks collected');
            this.cleanup();
            reject(new Error('No audio data recorded'));
            return;
          }
          
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
          console.log('stopRecording: created blob, size:', audioBlob.size);
          
          // Validate blob size (minimum 100 bytes for valid webm header)
          if (audioBlob.size < 100) {
            console.error('stopRecording: blob too small, likely corrupted:', audioBlob.size);
            this.cleanup();
            reject(new Error('Recording too short or corrupted'));
            return;
          }
          
          this.cleanup();
          resolve(audioBlob);
        }, 100); // Brief delay to ensure all chunks are collected
      };

      this.mediaRecorder.onerror = (event: any) => {
        clearTimeout(safetyTimeout);
        console.error('stopRecording: MediaRecorder error:', event);
        // Try to return partial data if available
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
          console.warn('stopRecording: error but returning partial chunks, size:', audioBlob.size);
          this.cleanup();
          resolve(audioBlob);
        } else {
          this.cleanup();
          reject(new Error('MediaRecorder error during stop'));
        }
      };

      try {
        this.mediaRecorder.stop();
        console.log('stopRecording: stop() called successfully');
      } catch (err) {
        clearTimeout(safetyTimeout);
        console.error('stopRecording: error calling stop():', err);
        this.cleanup();
        reject(err);
      }
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  private cleanup(): void {
    console.log('AudioRecorder: cleanup called');
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        console.log('AudioRecorder: stopping track:', track.kind, track.id);
        track.stop();
      });
      this.stream = null;
    }
    if (this.vadDetector) {
      try { 
        console.log('AudioRecorder: stopping VAD detector');
        this.vadDetector.stop(); 
      } catch (err) {
        console.warn('AudioRecorder: error stopping VAD:', err);
      }
      this.vadDetector = null;
    }
    if (this.silenceDetector) {
      console.log('AudioRecorder: cleaning up silence detector');
      this.silenceDetector.cleanup();
      this.silenceDetector = null;
    }
    if (this.voiceActivityDetector) {
      console.log('AudioRecorder: cleaning up voice activity detector');
      this.voiceActivityDetector.cleanup();
      this.voiceActivityDetector = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.vadSilenceStart = null;
    this.recordingStartTime = null;
    console.log('AudioRecorder: cleanup complete');
  }

  // Convert webm to wav for better compatibility
  async convertToWav(audioBlob: Blob): Promise<Blob> {
    try {
      console.log('convertToWav: starting conversion, input size:', audioBlob.size);
      
      if (!audioBlob || audioBlob.size === 0) {
        console.error('convertToWav: empty or invalid blob');
        throw new Error('Cannot convert empty audio blob');
      }
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('convertToWav: arrayBuffer created, size:', arrayBuffer.byteLength);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000
      });
      
      console.log('convertToWav: decoding audio data');
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        console.error('convertToWav: decode failed:', decodeErr);
        await audioContext.close();
        throw new Error('Failed to decode audio. Recording may be corrupted.');
      }
      
      console.log('convertToWav: decoded successfully, duration:', audioBuffer.duration, 'channels:', audioBuffer.numberOfChannels);
      
      // Validate decoded audio
      if (audioBuffer.duration === 0 || audioBuffer.length === 0) {
        await audioContext.close();
        throw new Error('Decoded audio has zero duration');
      }
      
      // Convert to WAV format
      const wavBlob = this.audioBufferToWav(audioBuffer);
      console.log('convertToWav: WAV created, size:', wavBlob.size);
      
      // Close audio context to free resources
      try {
        await audioContext.close();
      } catch (closeErr) {
        console.warn('convertToWav: error closing audioContext:', closeErr);
      }
      
      // Validate WAV output
      if (wavBlob.size < 100) {
        throw new Error('WAV conversion produced invalid output');
      }
      
      return wavBlob;
    } catch (error) {
      console.error('Error converting audio:', error);
      // Don't fall back - throw the error so caller can handle
      throw error instanceof Error ? error : new Error('Audio conversion failed');
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);

    // Convert float samples to 16-bit PCM
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

