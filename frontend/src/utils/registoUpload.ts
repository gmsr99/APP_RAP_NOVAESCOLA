import imageCompression from 'browser-image-compression';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';

const MAX_SIZE_BYTES = 1 * 1024 * 1024;
const BUCKET = 'registos-sessoes';

export interface UploadResult {
  ok: boolean;
  storagePath?: string;
  error?: string;
  sizeKb?: number;
}

export async function uploadRegistoSessao(
  file: File,
  projetoId: number,
  aulaId: number,
): Promise<UploadResult> {
  try {
    // 1. Compress image
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      initialQuality: 0.75,
    });

    // 2. Convert to single-page PDF via canvas
    const bitmap = await createImageBitmap(compressed);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    const imgData = canvas.toDataURL('image/jpeg', 0.75);

    const orientation: 'l' | 'p' = bitmap.width > bitmap.height ? 'l' : 'p';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [bitmap.width, bitmap.height] });
    pdf.addImage(imgData, 'JPEG', 0, 0, bitmap.width, bitmap.height);
    const pdfBytes = pdf.output('arraybuffer');

    // 3. Validate size
    if (pdfBytes.byteLength > MAX_SIZE_BYTES) {
      return {
        ok: false,
        error: `Ficheiro demasiado grande (${Math.round(pdfBytes.byteLength / 1024)}KB). Máximo: 1MB.`,
      };
    }

    // 4. Upload to Supabase Storage
    const path = `${projetoId}/${aulaId}/registo.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      return { ok: false, error: uploadError.message };
    }

    return {
      ok: true,
      storagePath: path,
      sizeKb: Math.round(pdfBytes.byteLength / 1024),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: message };
  }
}
