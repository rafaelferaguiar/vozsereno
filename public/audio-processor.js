/**
 * AudioWorkletProcessor — roda em thread dedicada de áudio, imune a throttling do browser.
 * Coleta amostras, converte para PCM Int16 e envia ao thread principal via MessagePort.
 * Buffer menor = menor latência = menos palavras perdidas em fala rápida.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 512 amostras a 16kHz = ~32ms por chunk
    // Mais frequente = menor latência, menos risco de perder sílabas em fala rápida
    this._buffer = [];
    this._bufferSize = 512;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    // Acumula amostras no buffer local
    for (let i = 0; i < channelData.length; i++) {
      this._buffer.push(channelData[i]);
    }

    // Quando acumular o suficiente, envia ao thread principal
    while (this._buffer.length >= this._bufferSize) {
      const chunk = this._buffer.splice(0, this._bufferSize);
      const int16 = new Int16Array(this._bufferSize);
      for (let i = 0; i < this._bufferSize; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      // Transfere o buffer sem copiar (zero-copy)
      this.port.postMessage({ pcm: int16.buffer }, [int16.buffer]);
    }

    return true; // Manter o processor vivo
  }
}

registerProcessor('pcm-processor', PCMProcessor);
