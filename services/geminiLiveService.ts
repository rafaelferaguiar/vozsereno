import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Audio configuration constants
const INPUT_SAMPLE_RATE = 16000;

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isConnected = false;

  // Callbacks
  public onTranscriptionUpdate: (text: string, isFinal: boolean) => void = () => {};
  public onError: (error: string) => void = () => {};
  public onConnect: () => void = () => {};
  public onDisconnect: (isFatal: boolean) => void = () => {};

  private currentInputTranscription = '';

  constructor() {
    // @ts-ignore
    this.ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
  }

  /**
   * Connects to the Gemini Live API and waits for the session to be ready.
   */
  async connect() {
    try {
      this.session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('[GeminiLive] Session opened ✅');
            this.isConnected = true;
            this.onConnect();
          },
          onmessage: (message: LiveServerMessage) => this.handleMessage(message),
          onerror: (e: ErrorEvent) => {
            console.error('[GeminiLive] WebSocket error ❌', e);
            this.isConnected = false;
            this.onError('Erro na conexão WebSocket com a IA.');
          },
          onclose: (e: CloseEvent) => {
            console.log(`[GeminiLive] Session closed (code=${e.code}, reason=${e.reason})`);
            this.isConnected = false;
            // Detect fatal/config errors that should NOT trigger reconnect
            const reason = (e.reason || '').toLowerCase();
            const isFatal =
              (e.code === 1000 && (reason.includes('not found') || reason.includes('not supported') || reason.includes('invalid'))) ||
              e.code === 1002 || // Protocol error
              e.code === 1003 || // Unsupported data
              e.code === 1007 || // Invalid frame payload
              e.code === 1008 || // Policy violation
              e.code === 1009 || // Message too big
              e.code === 1011;   // Internal error
            this.onDisconnect(isFatal);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: `
            Você é um transcritor profissional de legendas ao vivo para Português do Brasil.
            Sua única função é ouvir o áudio e converter fielmente em texto bem pontuado.
            
            REGRAS RÍGIDAS:
            1. NÃO inclua tags de metadados como <noise>, [risos], [aplausos] ou *sons*. Ignore o que não for fala.
            2. Se o áudio for apenas ruído ou silêncio, NÃO GERE TEXTO. Fique em silêncio.
            3. Não alucine textos em outros idiomas (Japonês, Chinês, Inglês) se a fala for em Português.
            4. Mantenha a pontuação gramatical correta para facilitar a leitura em projeções.
            5. NUNCA responda ao conteúdo do que está sendo dito. Apenas transcreva.
          `,
        },
      });
    } catch (error: any) {
      this.isConnected = false;
      this.onError(error.message || 'Falha ao conectar com a API Gemini.');
      throw error;
    }
  }

  /**
   * Starts capturing audio using AudioWorklet (runs in dedicated audio thread,
   * immune to browser tab throttling and background suspension).
   */
  async startAudioStream(stream: MediaStream) {
    if (!this.session) {
      throw new Error("Session not initialized. Call connect() first.");
    }

    this.stream = stream;

    // Create AudioContext at the exact sample rate the API expects
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: INPUT_SAMPLE_RATE,
      latencyHint: 'interactive',
    });

    // Load the AudioWorklet module from the public folder
    await this.inputAudioContext.audioWorklet.addModule('/audio-processor.js');

    this.source = this.inputAudioContext.createMediaStreamSource(stream);

    // AudioWorkletNode runs in a separate audio rendering thread — can't be throttled
    this.workletNode = new AudioWorkletNode(this.inputAudioContext, 'pcm-processor');

    // Receive PCM chunks from the audio thread and send to Gemini
    this.workletNode.port.onmessage = (event) => {
      if (!this.isConnected || !this.session) return;

      const pcmBuffer: ArrayBuffer = event.data.pcm;
      const base64 = this.arrayBufferToBase64(pcmBuffer);

      try {
        this.session.sendRealtimeInput({
          media: {
            data: base64,
            mimeType: 'audio/pcm;rate=16000',
          }
        });
      } catch (err) {
        console.warn('[GeminiLive] Failed to send audio chunk:', err);
      }
    };

    this.source.connect(this.workletNode);
    // Connect to destination to prevent Chrome from suspending the AudioContext
    this.workletNode.connect(this.inputAudioContext.destination);

    console.log('[GeminiLive] AudioWorklet streaming started 🎙️');
  }

  /**
   * Stops audio capture and closes the session gracefully.
   */
  async disconnect() {
    this.isConnected = false;

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      await this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.session) {
      try {
        if (typeof this.session.close === 'function') {
          await this.session.close();
        }
      } catch (_) {
        // Ignore errors on close
      }
      this.session = null;
    }

    this.currentInputTranscription = '';
    console.log('[GeminiLive] Disconnected cleanly 🔌');
  }

  /**
   * Remove unwanted tags like <noise> and strange characters.
   */
  private cleanText(text: string): string {
    return text
      .replace(/<.*?>/g, '')      // Remove XML tags like <noise>
      .replace(/\[.*?\]/g, '')    // Remove things like [sound]
      .replace(/^\s*[-*]\s*/, '') // Remove list markers at start
      .trim();
  }

  private handleMessage(message: LiveServerMessage) {
    if (message.serverContent?.inputTranscription) {
      const rawText = message.serverContent.inputTranscription.text;
      if (rawText) {
        this.currentInputTranscription += rawText;
        const cleanedPartial = this.cleanText(this.currentInputTranscription);
        if (cleanedPartial) {
          this.onTranscriptionUpdate(cleanedPartial, false);
        }
      }
    }

    if (message.serverContent?.turnComplete) {
      if (this.currentInputTranscription.trim()) {
        const finalCleaned = this.cleanText(this.currentInputTranscription);
        if (finalCleaned.length > 0) {
          this.onTranscriptionUpdate(finalCleaned, true);
        }
        this.currentInputTranscription = '';
      }
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    // Process in chunks to avoid call stack overflow on large buffers
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }
}