import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import type { UploadResult } from './registoUpload';

const BUCKET = 'evidencias-sessoes';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadEvidencia(
  file: File,
  projetoId: number,
  aulaId: number,
  index: number,
): Promise<UploadResult> {
  try {
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      initialQuality: 0.8,
    });

    const bitmap = await createImageBitmap(compressed);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.8);

    const res = await fetch(jpegDataUrl);
    const blob = await res.blob();

    if (blob.size > MAX_SIZE_BYTES) {
      return {
        ok: false,
        error: `Ficheiro demasiado grande (${Math.round(blob.size / 1024)}KB). Máximo: 5MB.`,
      };
    }

    const path = `${projetoId}/${aulaId}/${index}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

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
