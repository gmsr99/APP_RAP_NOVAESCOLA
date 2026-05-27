import { supabase } from '@/lib/supabase';
import type { UploadResult } from './registoUpload';

const BUCKET = 'feedback-sessoes';
const MAX_DURATION_MS = 30_000;

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export interface RecordingSession {
  stop: () => Promise<Blob>;
  onTick: (cb: (remainingSeconds: number) => void) => void;
}

export async function startRecording(): Promise<RecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = getSupportedMimeType();

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(100);

  let tickCb: ((s: number) => void) | null = null;
  let stopped = false;
  const startTime = Date.now();

  const tickInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, Math.ceil((MAX_DURATION_MS - elapsed) / 1000));
    tickCb?.(remaining);
  }, 500);

  let resolveStop!: (blob: Blob) => void;
  const stopPromise = new Promise<Blob>((resolve) => {
    resolveStop = resolve;
  });

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
    resolveStop(blob);
  };

  const autoStopTimeout = setTimeout(() => doStop(), MAX_DURATION_MS);

  function doStop() {
    if (stopped) return;
    stopped = true;
    clearInterval(tickInterval);
    clearTimeout(autoStopTimeout);
    stream.getTracks().forEach((t) => t.stop());
    if (recorder.state !== 'inactive') recorder.stop();
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
    const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    const path = `${projetoId}/${aulaId}/feedback.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true });

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
