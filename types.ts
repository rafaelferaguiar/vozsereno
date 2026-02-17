export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date; // Serialized as string in BroadcastChannel
  isFinal: boolean;
}

export enum AudioSourceType {
  MICROPHONE = 'MICROPHONE',
  SYSTEM_AUDIO = 'SYSTEM_AUDIO', // Via getDisplayMedia
}

export interface LiveStatus {
  isConnected: boolean;
  isRecording: boolean;
  error?: string;
}

// Tipos para o sistema de Transmissão
export type BroadcastMessageType = 'SYNC' | 'STATUS';

export interface BroadcastMessage {
  type: BroadcastMessageType;
  payload: {
    segments?: TranscriptSegment[];
    currentPartial?: string;
    isLive?: boolean;
    timestamp?: number; // Para verificar latência/ordem
  };
}
