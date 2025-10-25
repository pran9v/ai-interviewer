export class SilenceDetector {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private silenceStartTime: number | null = null;
  private silenceThreshold = -45; // dB (increased for better sensitivity)
  private silenceTimeout = 7500; // 7.5 seconds
  private silenceBufferSize = 5; // Number of consecutive silent readings needed
  private silenceBuffer: boolean[] = [];
  private isMonitoring = false;
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
    this.isMonitoring = true;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const smoothingFactor = 0.1; // For exponential moving average
    let smoothedAverage = 0;
    
    const checkSilence = () => {
      if (!this.analyser || !this.isMonitoring) return;

      this.analyser.getFloatFrequencyData(dataArray);
      
      // Calculate average volume level using exponential moving average
      const instantAverage = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      smoothedAverage = smoothedAverage * (1 - smoothingFactor) + instantAverage * smoothingFactor;
      
      // Add to silence buffer
      this.silenceBuffer.push(smoothedAverage < this.silenceThreshold);
      if (this.silenceBuffer.length > this.silenceBufferSize) {
        this.silenceBuffer.shift();
      }
      
      // Check if we have enough consecutive silence readings
      const isSilent = this.silenceBuffer.length === this.silenceBufferSize && 
                      this.silenceBuffer.every(value => value);
      
      if (isSilent) {
        if (!this.silenceStartTime) {
          this.silenceStartTime = Date.now();
          console.log('Silence started', { smoothedAverage, threshold: this.silenceThreshold });
        } else if (Date.now() - this.silenceStartTime >= this.silenceTimeout) {
          console.log('Silence detected', { 
            duration: Date.now() - this.silenceStartTime,
            average: smoothedAverage 
          });
          this.onSilenceDetected();
          this.silenceStartTime = null;
          this.silenceBuffer = [];
          return;
        }
      } else {
        if (this.silenceStartTime) {
          console.log('Silence broken', { smoothedAverage, threshold: this.silenceThreshold });
        }
        this.silenceStartTime = null;
      }
      
      requestAnimationFrame(checkSilence);
    };

    checkSilence();
  }

  public cleanup() {
    this.isMonitoring = false;
    this.silenceBuffer = [];
    this.silenceStartTime = null;
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}