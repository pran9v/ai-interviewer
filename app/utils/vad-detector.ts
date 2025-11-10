export type VADState = 'SPEECH' | 'SILENCE' | 'NOISE' | 'ERROR' | string;

export class VADDetector {
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private vadInstance: any = null;
  private sampleRate: number = 48000;
  private onStateChangeCb: ((state: VADState) => void) | null = null;
  private started = false;

  constructor(private stream: MediaStream, sampleRate?: number) {
    if (sampleRate) this.sampleRate = sampleRate;
  }

  setOnStateChange(cb: (state: VADState) => void) {
    this.onStateChangeCb = cb;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: this.sampleRate,
    });
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // Try dynamic import of the 'vad' package and handle common shapes
    try {
      // Use an indirect/dynamic import to prevent Next.js from statically
      // resolving and bundling the module at build time. The `vad` package
      // in node_modules contains server-side requires (e.g. `require('db')`)
      // that break the client build. Using `new Function` hides the import
      // from the bundler so it's only requested at runtime in the browser.
      const imported = await (new Function("return import('vad')")()) as any;
      console.log('VADDetector: imported vad module', !!imported);
      const VADModule = (imported && (imported.default || imported.VAD || imported)) as any;

      try {
        if (typeof VADModule === 'function') {
          try {
            this.vadInstance = new VADModule(this.sampleRate);
          } catch {
            this.vadInstance = new VADModule();
          }
        } else {
          this.vadInstance = VADModule;
        }

        if (this.vadInstance && typeof this.vadInstance.on === 'function') {
          // wire common event names
          this.vadInstance.on('speech', () => this.onStateChangeCb?.('SPEECH'));
          this.vadInstance.on('silence', () => this.onStateChangeCb?.('SILENCE'));
          this.vadInstance.on('noise', () => this.onStateChangeCb?.('NOISE'));
          this.vadInstance.on('voice_start', () => this.onStateChangeCb?.('SPEECH'));
          this.vadInstance.on('voice_stop', () => this.onStateChangeCb?.('SILENCE'));
        }
      } catch (err) {
        console.warn('VAD constructor fallback failed', err);
        this.vadInstance = null;
      }
    } catch (err) {
      console.warn('Could not dynamically import vad package, VAD disabled', err);
      this.vadInstance = null;
    }

    // Use ScriptProcessorNode to capture audio and feed to VAD
    const bufferSize = 4096;
    this.processor = (this.audioContext as AudioContext).createScriptProcessor(bufferSize, 1, 1);

    this.processor.onaudioprocess = (ev: AudioProcessingEvent) => {
      const input = ev.inputBuffer.getChannelData(0);
      if (this.vadInstance && typeof this.vadInstance.process === 'function') {
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        try {
          const state = this.vadInstance.process(int16);
          if (state) {
            const st = ('' + state).toUpperCase();
            if (st.includes('SPEECH') || st.includes('VOICE') || st === '1') {
              this.onStateChangeCb?.('SPEECH');
            } else if (st.includes('SILENCE') || st === '0') {
              this.onStateChangeCb?.('SILENCE');
            } else {
              this.onStateChangeCb?.(st);
            }
          }
        } catch (err) {
          // ignore per-frame errors
        }
      } else if (this.vadInstance) {
        try {
          if (typeof this.vadInstance.processAudio === 'function') {
            this.vadInstance.processAudio(input);
          } else if (typeof this.vadInstance.processFloat32 === 'function') {
            this.vadInstance.processFloat32(input);
          } else if (typeof this.vadInstance.accept === 'function') {
            this.vadInstance.accept(input);
          }
        } catch (err) {
          // ignore
        }
      }
    };

    this.source.connect(this.processor);
    // connect processor to destination to keep it alive; user won't hear because it's the input
    this.processor.connect((this.audioContext as AudioContext).destination);
  }

  stop() {
    try {
      if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
        this.processor = null;
      }
      if (this.source) {
        try { this.source.disconnect(); } catch {}
        this.source = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      this.audioContext = null;
      try {
        if (this.vadInstance && typeof this.vadInstance.destroy === 'function') {
          this.vadInstance.destroy();
        }
      } catch (err) {}
      this.vadInstance = null;
      this.started = false;
    } catch (err) {
      console.warn('VADDetector.stop() error', err);
    }
  }
}
