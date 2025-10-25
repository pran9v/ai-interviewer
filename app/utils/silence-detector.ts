export class SilenceDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private silenceStartTime: number | null = null;
  private silenceThreshold = -50; // dB
  private silenceTimeout = 7500; // 7.5 seconds
  private onSilenceDetected: () => void;

  constructor(stream: MediaStream, onSilenceDetected: () => void) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.onSilenceDetected = onSilenceDetected;

    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);

    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.startMonitoring();
  }

  private startMonitoring() {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    
    const checkSilence = () => {
      if (!this.analyser) return;

      this.analyser.getFloatFrequencyData(dataArray);
      
      // Calculate average volume level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      
      if (average < this.silenceThreshold) {
        if (!this.silenceStartTime) {
          this.silenceStartTime = Date.now();
        } else if (Date.now() - this.silenceStartTime >= this.silenceTimeout) {
          this.onSilenceDetected();
          this.silenceStartTime = null;
          return;
        }
      } else {
        this.silenceStartTime = null;
      }
      
      requestAnimationFrame(checkSilence);
    };

    checkSilence();
  }

  public cleanup() {
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}