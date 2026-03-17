import { useEffect, useRef, useState, useCallback } from 'react';

interface PreloaderProps {
  visible: boolean;
}

export function Preloader({ visible }: PreloaderProps) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Draw video frames to canvas, replacing black pixels with transparent
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    if (!video.videoWidth || !video.videoHeight) {
      rafRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Match canvas size to video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;

    // Threshold: treat near-black pixels (R+G+B < 60) as transparent
    for (let i = 0; i < data.length; i += 4) {
      const brightness = data[i] + data[i + 1] + data[i + 2];
      if (brightness < 60) {
        data[i + 3] = 0; // fully transparent
      } else if (brightness < 120) {
        // Soft edge — partial transparency for anti-aliased edges
        data[i + 3] = Math.round((brightness - 60) / 60 * 255);
      }
    }

    ctx.putImageData(frame, 0, 0);
    rafRef.current = requestAnimationFrame(renderFrame);
  }, []);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      setFading(false);
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => { });
      }
    } else {
      setFading(true);
      const t = setTimeout(() => {
        setShouldRender(false);
        setFading(false);
      }, 450);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // Start/stop the canvas render loop when video plays
  useEffect(() => {
    if (!shouldRender) return;

    const video = videoRef.current;
    if (!video) return;

    const startLoop = () => {
      cancelAnimationFrame(rafRef.current);
      renderFrame();
    };
    const stopLoop = () => cancelAnimationFrame(rafRef.current);

    video.addEventListener('play', startLoop);
    video.addEventListener('pause', stopLoop);
    video.addEventListener('ended', stopLoop);

    // If already playing, start immediately
    if (!video.paused) startLoop();

    return () => {
      stopLoop();
      video.removeEventListener('play', startLoop);
      video.removeEventListener('pause', stopLoop);
      video.removeEventListener('ended', stopLoop);
    };
  }, [shouldRender, renderFrame]);

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none transition-opacity duration-[450ms]"
      style={{ opacity: fading ? 0 : 1, background: 'rgba(0, 0, 0, 0.60)' }}
    >
      {/* Hidden video — used as frame source only */}
      <video
        ref={videoRef}
        src="/preloader2.mp4"
        autoPlay
        muted
        playsInline
        loop
        className="absolute w-0 h-0 opacity-0"
      />
      {/* Visible canvas — renders frames with black removed */}
      <canvas
        ref={canvasRef}
        className="block w-auto max-h-[35vh] sm:max-h-[40vh]"
        style={{ clipPath: 'inset(10% 0 10% 0)' }}
      />
    </div>
  );
}
