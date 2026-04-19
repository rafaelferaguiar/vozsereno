// Audio configuration constants
const INPUT_SAMPLE_RATE = 16000;

export class DeepgramLiveService {
  private socket: WebSocket | null = null;
  private inputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isConnected = false;

  // Callbacks
  public onTranscriptionUpdate: (text: string, isFinal: boolean) => void = () => {};
  public onError: (error: string) => void = () => {};
  public onConnect: () => void = () => {};
  public onDisconnect: (isFatal: boolean, code: number) => void = () => {};

  private apiKey: string;

  constructor() {
    // Acessa a chave configurada no .env.local
    this.apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY || '';
  }

  /**
   * Connects to the Deepgram WebSocket API and waits for the session to be ready.
   */
  async connect(): Promise<void> {
    if (!this.apiKey) {
      const errorMsg = 'Chave VITE_DEEPGRAM_API_KEY não encontrada. Verifique seu arquivo .env.local';
      this.onError(errorMsg);
      this.onDisconnect(true, 1008);
      throw new Error(errorMsg);
    }

    return new Promise((resolve, reject) => {
      try {
        // Configuramos para Nova-2 (melhor modelo), pt-BR, formato inteligente (pontuação), buffer linear PCM 16kHz
        const url = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true&encoding=linear16&sample_rate=16000&interim_results=true';
        
        // Autenticação Deepgram via protocólo Sec-WebSocket-Protocol suportado por padrão no Browser
        this.socket = new WebSocket(url, ['token', this.apiKey]);

        this.socket.onopen = () => {
          console.log('[DeepgramLive] Session opened ✅');
          this.isConnected = true;
          this.onConnect();
          resolve();
        };

        this.socket.onmessage = (event: MessageEvent) => this.handleMessage(event);

        this.socket.onerror = (e: Event) => {
          console.error('[DeepgramLive] WebSocket error ❌', e);
          this.isConnected = false;
          // Se a conexão ainda não foi resolvida, rejeitamos a promisse
          reject(new Error('Erro na conexão WebSocket com a Deepgram.'));
          this.onError('Erro de conexão com o servidor de transcrição.');
        };

        this.socket.onclose = (e: CloseEvent) => {
          console.log(`[DeepgramLive] Session closed (code=${e.code}, reason="${e.reason}")`);
          this.isConnected = false;
          
          // Detect fatal/config errors that should NOT trigger reconnect
          // Deepgram generally uses standard close codes. 1008 = Policy Violation (invalid token).
          const isFatal = e.code === 1008 || e.code === 1003 || e.code === 1009 || e.code === 1011;
          this.onDisconnect(isFatal, e.code);
        };
      } catch (error: any) {
        this.isConnected = false;
        this.onError(error.message || 'Falha ao conectar com a API Deepgram.');
        reject(error);
      }
    });
  }

  /**
   * Starts capturing audio using AudioWorklet (runs in dedicated audio thread,
   * immune to browser tab throttling and background suspension).
   */
  async startAudioStream(stream: MediaStream) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Socket not initialized or connected. Call connect() first.");
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

    // Receive PCM chunks from the audio thread and send directly to Deepgram Stream
    this.workletNode.port.onmessage = (event) => {
      if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;

      // The worklet sends a raw float32/int16 PCM buffer.
      // Deepgram aceita o buffer binário bruto diretamente no WebSocket!
      const pcmBuffer: ArrayBuffer = event.data.pcm;

      try {
        this.socket.send(pcmBuffer);
      } catch (err) {
        console.warn('[DeepgramLive] Failed to send audio chunk:', err);
      }
    };

    this.source.connect(this.workletNode);
    // Connect to destination to prevent Chrome from suspending the AudioContext
    this.workletNode.connect(this.inputAudioContext.destination);

    console.log('[DeepgramLive] AudioWorklet streaming started 🎙️');
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

    if (this.socket) {
      try {
        // Send empty CloseStream message if needed by Deepgram, or just close
        if (this.socket.readyState === WebSocket.OPEN) {
            // Um pequeno buffer vazio indica fim da fala para o Deepgram fechar graciosamente
            this.socket.send(new Uint8Array(0));
            this.socket.close();
        }
      } catch (_) {
        // Ignore errors on close
      }
      this.socket = null;
    }

    console.log('[DeepgramLive] Disconnected cleanly 🔌');
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      
      // O Deepgram envia vários tipos de dados, validamos se é um Resultado válido
      if (data.type === 'Results' && data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
        const alt = data.channel.alternatives[0];
        const transcript = alt.transcript;
        
        // Se a transcrição estiver vazia, ignoramos
        if (!transcript) return;

        // Se 'is_final' for verdeiro, enviamos como o fim daquele bloco. 
        // O Deepgram automaticamente lida com pausas e envia is_final: true.
        if (data.is_final) {
          this.onTranscriptionUpdate(transcript, true);
        } else {
          // Transcrição Parcial sendo construída
          this.onTranscriptionUpdate(transcript, false);
        }
      }
    } catch (err) {
      // Alguns pacotes do WS podem não ser JSON válidos, apenas ignoramos.
    }
  }
}
