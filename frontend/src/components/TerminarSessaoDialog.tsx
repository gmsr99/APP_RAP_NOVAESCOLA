import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Images, Mic, MicOff, MessageSquare, RefreshCw, Square, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { uploadRegistoSessao } from '@/utils/registoUpload';
import { uploadEvidencia } from '@/utils/evidenciaUpload';
import { startRecording, uploadAudioFeedback, type RecordingSession } from '@/utils/audioRecord';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aulaId: number | null;
  projetoId: number | null;
  requerDigitalizacao?: boolean;
  onSuccess: () => void;
}

type UploadSlot =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'done'; storagePath: string; sizeKb?: number }
  | { status: 'error'; error: string };

type RecordingState = 'idle' | 'recording' | 'done' | 'uploading';

export function TerminarSessaoDialog({ open, onOpenChange, aulaId, projetoId, requerDigitalizacao, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — folha de registo
  const [registoUpload, setRegistoUpload] = useState<UploadSlot>({ status: 'idle' });

  // Step 2 — evidências (até 5)
  const [evidencias, setEvidencias] = useState<UploadSlot[]>([]);

  // Step 3 — avaliação + feedback
  const [rating, setRating] = useState(0);
  const [feedbackMode, setFeedbackMode] = useState<'audio' | 'text'>('audio');
  const [feedbackText, setFeedbackText] = useState('');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [countdown, setCountdown] = useState(30);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionRef = useRef<RecordingSession | null>(null);

  // Refs para file inputs — padrão fiável em iOS Safari dentro de modais
  const registoCameraRef = useRef<HTMLInputElement>(null);
  const registoGalleryRef = useRef<HTMLInputElement>(null);
  const evidenciaCameraRef = useRef<HTMLInputElement>(null);
  const evidenciaGalleryRef = useRef<HTMLInputElement>(null);

  // Reset completo ao fechar
  useEffect(() => {
    if (!open) {
      setStep(1);
      setRegistoUpload({ status: 'idle' });
      setEvidencias([]);
      setRating(0);
      setFeedbackMode('audio');
      setFeedbackText('');
      setRecordingState('idle');
      setCountdown(30);
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioPath(null);
      setIsSubmitting(false);
      if (sessionRef.current) {
        sessionRef.current.stop().catch(() => {});
        sessionRef.current = null;
      }
    }
  }, [open]);

  // ──────────────────── Step 1: upload registo ────────────────────

  async function handleRegistoFile(file: File) {
    if (!aulaId || projetoId == null) {
      setRegistoUpload({ status: 'error', error: 'Sessão sem projeto associado.' });
      return;
    }
    setRegistoUpload({ status: 'uploading' });
    const result = await uploadRegistoSessao(file, projetoId, aulaId);
    if (result.ok && result.storagePath) {
      try {
        await api.post('/api/aula-registos', { aula_id: aulaId, storage_path: result.storagePath });
        setRegistoUpload({ status: 'done', storagePath: result.storagePath, sizeKb: result.sizeKb });
      } catch {
        setRegistoUpload({ status: 'error', error: 'Erro ao guardar registo no servidor.' });
      }
    } else {
      setRegistoUpload({ status: 'error', error: result.error });
    }
  }

  // ──────────────────── Step 2: upload evidências ────────────────────

  async function handleEvidenciaFile(file: File) {
    if (!aulaId || projetoId == null) return;
    const index = evidencias.length;
    if (index >= 5) return;
    setEvidencias(prev => [...prev, { status: 'uploading' }]);
    const result = await uploadEvidencia(file, projetoId, aulaId, index);
    if (result.ok && result.storagePath) {
      try {
        await api.post('/api/aula-evidencias', { aula_id: aulaId, storage_path: result.storagePath });
        setEvidencias(prev => {
          const next = [...prev];
          next[index] = { status: 'done', storagePath: result.storagePath!, sizeKb: result.sizeKb };
          return next;
        });
      } catch {
        setEvidencias(prev => {
          const next = [...prev];
          next[index] = { status: 'error', error: 'Erro ao guardar no servidor.' };
          return next;
        });
      }
    } else {
      setEvidencias(prev => {
        const next = [...prev];
        next[index] = { status: 'error', error: result.error ?? 'Erro desconhecido' };
        return next;
      });
    }
  }

  function removeEvidencia(i: number) {
    setEvidencias(prev => prev.filter((_, idx) => idx !== i));
  }

  // ──────────────────── Step 3: gravação ────────────────────

  async function handleStartRecording() {
    try {
      const session = await startRecording();
      sessionRef.current = session;
      setRecordingState('recording');
      setCountdown(30);
      session.onTick((remaining) => setCountdown(remaining));
    } catch {
      toast.error('Sem acesso ao microfone. Verifica as permissões.');
    }
  }

  async function handleStopRecording() {
    if (!sessionRef.current) return;
    const blob = await sessionRef.current.stop();
    sessionRef.current = null;
    setAudioBlob(blob);
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    setRecordingState('done');
    setCountdown(30);
  }

  function handleReRecord() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioPath(null);
    setRecordingState('idle');
    setCountdown(30);
  }

  // ──────────────────── Submissão final ────────────────────

  const handleSubmit = useCallback(async () => {
    if (!aulaId || rating < 1) return;
    setIsSubmitting(true);
    try {
      let finalAudioPath = audioPath;
      if (feedbackMode === 'audio' && audioBlob && !finalAudioPath && projetoId != null) {
        setRecordingState('uploading');
        const uploadResult = await uploadAudioFeedback(audioBlob, projetoId, aulaId);
        if (uploadResult.ok && uploadResult.storagePath) {
          finalAudioPath = uploadResult.storagePath;
          setAudioPath(finalAudioPath);
        } else {
          toast.error('Erro ao fazer upload do áudio. Tenta novamente.');
          setIsSubmitting(false);
          setRecordingState('done');
          return;
        }
      }
      await api.post(`/api/aulas/${aulaId}/terminar`, {
        avaliacao: rating,
        obs_termino: feedbackMode === 'text' && feedbackText.trim() ? feedbackText.trim() : undefined,
        feedback_audio_path: feedbackMode === 'audio' ? (finalAudioPath ?? undefined) : undefined,
      });
      toast.success('Sessão terminada!');
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Erro ao terminar sessão.');
    } finally {
      setIsSubmitting(false);
    }
  }, [aulaId, projetoId, rating, feedbackMode, feedbackText, audioBlob, audioPath, onSuccess, onOpenChange]);

  // ──────────────────── Render ────────────────────

  const stepLabels = ['Registo', 'Evidências', 'Avaliação'];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSubmitting) onOpenChange(o); }}>
      <DialogContent className="w-full sm:max-w-[440px] max-h-[95dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#6B7280]" />
            Terminar Sessão
          </DialogTitle>
          <DialogDescription>
            Passo {step} de 3 — {stepLabels[step - 1]}
          </DialogDescription>
          <div className="flex gap-1.5 pt-1">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  n <= step ? 'bg-[#6B7280]' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </DialogHeader>

        {/* ── Step 1: Folha de Registo ── */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <Label className="font-medium">Fotografa a folha de registo da sessão</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={registoUpload.status === 'uploading'}
                onClick={() => registoCameraRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
                Câmara
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={registoUpload.status === 'uploading'}
                onClick={() => registoGalleryRef.current?.click()}
              >
                <Images className="h-4 w-4" />
                Galeria
              </Button>
            </div>
            {registoUpload.status === 'uploading' && (
              <p className="text-sm text-muted-foreground animate-pulse flex items-center gap-1.5">
                <Upload className="h-4 w-4" /> A processar...
              </p>
            )}
            {registoUpload.status === 'done' && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                ✓ Registo enviado ({registoUpload.sizeKb} KB)
              </p>
            )}
            {registoUpload.status === 'error' && (
              <p className="text-sm text-destructive">{registoUpload.error}</p>
            )}
            {/* Inputs ocultos via display:none — mais fiáveis que sr-only em iOS */}
            <input
              ref={registoCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleRegistoFile(f); e.target.value = ''; }}
            />
            <input
              ref={registoGalleryRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleRegistoFile(f); e.target.value = ''; }}
            />
          </div>
        )}

        {/* ── Step 2: Evidências ── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <Label className="font-medium">Fotos de evidência da aula (máx. 5)</Label>
            <div className="grid grid-cols-3 gap-2">
              {evidencias.map((slot, i) => (
                <div key={i} className="relative aspect-square rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                  {slot.status === 'uploading' && (
                    <span className="text-xs text-muted-foreground animate-pulse">A enviar...</span>
                  )}
                  {slot.status === 'done' && (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                      <button
                        onClick={() => removeEvidencia(i)}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  {slot.status === 'error' && (
                    <Trash2 className="h-5 w-5 text-destructive" />
                  )}
                </div>
              ))}
              {evidencias.length < 5 && (
                <div className="aspect-square rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => evidenciaCameraRef.current?.click()}
                    className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-muted transition-colors w-full"
                  >
                    <Camera className="h-5 w-5 text-muted-foreground/60" />
                    <span className="text-[10px] text-muted-foreground/60">Câmara</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => evidenciaGalleryRef.current?.click()}
                    className="flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-muted transition-colors w-full"
                  >
                    <Images className="h-5 w-5 text-muted-foreground/60" />
                    <span className="text-[10px] text-muted-foreground/60">Galeria</span>
                  </button>
                </div>
              )}
            </div>
            {evidencias.length === 0 && (
              <p className="text-xs text-muted-foreground">Podes ignorar este passo se não tiveres fotos para partilhar.</p>
            )}
            <input
              ref={evidenciaCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleEvidenciaFile(f); e.target.value = ''; }}
            />
            <input
              ref={evidenciaGalleryRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleEvidenciaFile(f); e.target.value = ''; }}
            />
          </div>
        )}

        {/* ── Step 3: Avaliação + Feedback ── */}
        {step === 3 && (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="font-medium">Avaliação desta Sessão</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star
                    key={n}
                    className={cn(
                      'h-8 w-8 cursor-pointer transition-colors',
                      n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-300'
                    )}
                    onClick={() => setRating(n)}
                  />
                ))}
                {rating > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">{rating}/5</span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <Label className="font-medium">Feedback</Label>
                <div className="ml-auto flex rounded-md border overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setFeedbackMode('audio')}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 transition-colors',
                      feedbackMode === 'audio' ? 'bg-[#6B7280] text-white' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Mic className="h-3 w-3" /> Áudio
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackMode('text')}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 transition-colors',
                      feedbackMode === 'text' ? 'bg-[#6B7280] text-white' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <MessageSquare className="h-3 w-3" /> Texto
                  </button>
                </div>
              </div>

              {feedbackMode === 'audio' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Fala livremente sobre como correu a sessão (máx. 30s)</p>

                  {recordingState === 'idle' && (
                    <Button variant="outline" className="w-full gap-2" onClick={handleStartRecording}>
                      <Mic className="h-4 w-4" /> Gravar
                    </Button>
                  )}

                  {recordingState === 'recording' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-destructive flex items-center gap-1.5 animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
                          A gravar...
                        </span>
                        <span className="text-sm tabular-nums font-mono">
                          00:{String(countdown).padStart(2, '0')}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full gap-2 border-destructive text-destructive hover:bg-destructive/10"
                        onClick={handleStopRecording}
                      >
                        <Square className="h-4 w-4 fill-current" /> Parar
                      </Button>
                    </div>
                  )}

                  {recordingState === 'done' && audioUrl && (
                    <div className="space-y-2">
                      <audio src={audioUrl} controls className="w-full h-9" />
                      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleReRecord}>
                        <RefreshCw className="h-3.5 w-3.5" /> Regravar
                      </Button>
                    </div>
                  )}

                  {recordingState === 'uploading' && (
                    <p className="text-sm text-muted-foreground animate-pulse flex items-center gap-1.5">
                      <MicOff className="h-4 w-4" /> A fazer upload do áudio...
                    </p>
                  )}
                </div>
              )}

              {feedbackMode === 'text' && (
                <Textarea
                  placeholder="Escreve como correu a sessão..."
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  className="resize-none"
                  rows={4}
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <div className="flex gap-2 w-full sm:w-auto">
              {!requerDigitalizacao && (
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Ignorar
                </Button>
              )}
              <Button
                onClick={() => setStep(2)}
                disabled={requerDigitalizacao && registoUpload.status !== 'done'}
                className="bg-[#6B7280] hover:bg-[#555e68] text-white"
              >
                Seguinte
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="bg-[#6B7280] hover:bg-[#555e68] text-white"
              >
                Seguinte
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={rating < 1 || isSubmitting || (feedbackMode === 'audio' && (recordingState === 'recording' || recordingState === 'uploading'))}
                className="bg-[#6B7280] hover:bg-[#555e68] text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isSubmitting ? 'A submeter...' : 'Submeter'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
