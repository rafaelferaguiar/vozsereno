import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Audio configuration constants
const INPUT_SAMPLE_RATE = 16000;

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  // Callbacks
  public onTranscriptionUpdate: (text: string, isFinal: boolean) => void = () => { };
  public onError: (error: string) => void = () => { };
  public onConnect: () => void = () => { };
  public onDisconnect: () => void = () => { };

  private currentInputTranscription = '';

  constructor() {
    // Initialize API client
    // @ts-ignore process.env.VITE_GEMINI_API_KEY is injected by the environment
    this.ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
  }

  /**
   * Connects to the Live API
   */
  async connect() {
    try {
      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            this.onConnect();
          },
          onmessage: (message: LiveServerMessage) => this.handleMessage(message),
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live Error', e);
            this.onError('Erro na conexão com a IA.');
          },
          onclose: (e: CloseEvent) => {
            console.log('Gemini Live Session Closed');
            this.onDisconnect();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: `
            Você é um transcritor profissional de legendas ao vivo para Português do Brasil.
            Sua única função é ouvir o áudio e converter fielmente em texto bem pontuado.
            
            REGRAS RÍGIDAS:
            1. NÃO inclua tags de metadados como <noise>, [risos], [applausos] ou *sons*. Ignore o que não for fala.
            2. Se o áudio for apenas ruído ou silêncio, NÃO GERE TEXTO. Fique em silêncio.
            3. Não alucine textos em outros idiomas (Japonês, Chinês) se a fala for em Português.
            4. Mantenha a pontuação gramatical correta para facilitar a leitura em projeções.
          `,
        },
      });
      await this.sessionPromise;
    } catch (error: any) {
      this.onError(error.message || 'Falha ao conectar.');
    }
  }

  /**
   * Starts capturing audio from the specified source and streams it to the model.
   */
  async startAudioStream(stream: MediaStream) {
    if (!this.sessionPromise) {
      throw new Error("Session not initialized. Call connect() first.");
    }

    this.stream = stream;
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: INPUT_SAMPLE_RATE,
    });

    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);

    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createBlob(inputData);

      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  /**
   * Stops audio capture and closes the session.
   */
  async disconnect() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.inputAudioContext) {
      await this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.sessionPromise?.then(session => {
      // @ts-ignore 
      if (typeof session.close === 'function') {
        session.close();
      }
    });

    this.sessionPromise = null;
    this.currentInputTranscription = '';
  }

  /**
   * Remove tags indesejadas como <noise> e caracteres estranhos
   */
  private cleanText(text: string): string {
    return text
      .replace(/<.*?>/g, '')      // Remove tags XML como <noise>
      .replace(/\[.*?\]/g, '')    // Remove coisas como [som]
      .replace(/^\s*[-*]\s*/, '') // Remove marcadores de lista no inicio
      .trim();
  }

  private handleMessage(message: LiveServerMessage) {
    if (message.serverContent?.inputTranscription) {
      const rawText = message.serverContent.inputTranscription.text;
      if (rawText) {
        this.currentInputTranscription += rawText;

        // Limpa visualmente para a atualização parcial
        const cleanedPartial = this.cleanText(this.currentInputTranscription);
        if (cleanedPartial) {
          this.onTranscriptionUpdate(cleanedPartial, false);
        }
      }
    }

    if (message.serverContent?.turnComplete) {
      if (this.currentInputTranscription.trim()) {
        const finalCleaned = this.cleanText(this.currentInputTranscription);

        // Só envia se sobrou algum texto após a limpeza
        if (finalCleaned.length > 0) {
          this.onTranscriptionUpdate(finalCleaned, true);
        }

        this.currentInputTranscription = '';
      }
    }
  }

  private createBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = Math.max(-1, Math.min(1, data[i])) * 32768;
    }

    return {
      data: this.arrayBufferToBase64(int16.buffer),
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}