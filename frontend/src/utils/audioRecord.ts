import { supabase } from '@/lib/supabase';
import type { UploadResult } from './registoUpload';

// lamejs has no official @types package
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: any;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lamejs = require('lamejs') as {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
    encodeBuffer(left: Int16Array): Int8Array;
    flush(): Int8Array;
  };
};

const BUCKET = 'feedback-sessoes';
const MAX_DURATION_MS = 30_000;

export interface RecordingSession {
  stop: () => Promise<Blob>;
  onTick: (cb: (remainingSeconds: number) => void) => void;
}

export async function startRecording(): Promise<RecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);

  // ScriptProcessorNode is deprecated but universally supported; buffer size 4096
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(audioCtx.destination);

  const encoder = new lamejs.Mp3Encoder(1, audioCtx.sampleRate, 128);
  const mp3Chunks: Int8Array[] = [];

  let tickCb: ((s: number) => void) | null = null;
  let stopped = false;
  const startTime = Date.now();

  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    if (stopped) return;
    const float32 = e.inputBuffer.getChannelData(0);
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32767));
    }
    const encoded = encoder.encodeBuffer(int16);
    if (encoded.length > 0) mp3Chunks.push(encoded);
  };

  const tickInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, Math.ceil((MAX_DURATION_MS - elapsed) / 1000));
    tickCb?.(remaining);
  }, 500);

  let resolveStop: (blob: Blob) => void;
  const stopPromise = new Promise<Blob>((resolve) => {
    resolveStop = resolve;
  });

  // Auto-stop at 30 s
  const autoStopTimeout = setTimeout(() => {
    doStop();
  }, MAX_DURATION_MS);

  function doStop() {
    if (stopped) return;
    stopped = true;
    clearInterval(tickInterval);
    clearTimeout(autoStopTimeout);
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void audioCtx.close();

    const tail = encoder.flush();
    if (tail.length > 0) mp3Chunks.push(tail);
    const blob = new Blob(mp3Chunks, { type: 'audio/mpeg' });
    resolveStop(blob);
  }

  return {
    stop: () => {
      doStop();
      return stopPromise;
    },
    onTick: (cb) => {
      tickCb = cb;
    },
  };
}

export async function uploadAudioFeedback(
  blob: Blob,
  projetoId: number,
  aulaId: number,
): Promise<UploadResult> {
  try {
    const path = `${projetoId}/${aulaId}/feedback.mp3`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) {
      return { ok: false, error: uploadError.message };
    }

    return {
      ok: true,
      storagePath: path,
      sizeKb: Math.round(blob.size / 1024),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: message };
  }
}
