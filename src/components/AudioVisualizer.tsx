import React, { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
  volume: number;
  isSpeaking: boolean;
  stream: MediaStream | null;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isActive,
  volume,
  isSpeaking,
  stream,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    // Standard audio analyser setup if stream is active
    if (stream && isActive) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
      } catch (e) {
        console.warn("Could not load browser AudioContext for visualizer:", e);
      }
    } else {
      // Clean up audio nodes
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [stream, isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      
      // Black slate background inside console style
      ctx.fillStyle = "#0c1017";
      ctx.fillRect(0, 0, width, height);

      // Draw subtle gridlines
      ctx.strokeStyle = "rgba(30, 41, 59, 0.4)";
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let j = 0; j < height; j += 20) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(width, j);
        ctx.stroke();
      }

      // Draw baseline middle line
      ctx.strokeStyle = "rgba(51, 65, 85, 0.3)";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 0;
      const dataArray = new Uint8Array(bufferLength);
      let amplitude = 0;

      if (analyserRef.current && isActive) {
        analyserRef.current.getByteTimeDomainData(dataArray);
        // Compute average root-mean-square amplitude to drive basic indicators
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        amplitude = Math.sqrt(sum / bufferLength);
      }

      // Update Phase for procedural waveforms
      phaseRef.current += 0.08;

      if (isActive) {
        // Microphones recording wave: blend real analyser data with sleek sinus oscillations
        const primaryColor = "#22c55e"; // Emerald green
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(34, 197, 94, 0.5)";
        
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        const slices = 120;
        const sliceWidth = width / slices;
        let x = 0;

        for (let i = 0; i <= slices; i++) {
          const ratio = i / slices;
          // Apply a bell envelope so waves fade cleanly at boundaries
          const envelope = Math.sin(ratio * Math.PI);
          
          let yOffset = 0;
          if (analyserRef.current && bufferLength > 0) {
            const dataIdx = Math.floor(ratio * bufferLength);
            yOffset = ((dataArray[dataIdx] - 128) / 128) * (height * 0.4);
          } else {
            // Procedural sine waves fallback
            yOffset = Math.sin(ratio * Math.PI * 4.5 + phaseRef.current) * 15;
            yOffset += Math.sin(ratio * Math.PI * 10 - phaseRef.current * 1.5) * 6;
            // Introduce artificial mouse volume or noise
            yOffset *= (0.15 + volume * 0.85);
          }

          const y = (height / 2) + (yOffset * envelope);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();

        // Draw smaller ambient background harmonic waves
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(34, 197, 94, 0.25)";
        ctx.beginPath();
        x = 0;
        for (let i = 0; i <= slices; i++) {
          const ratio = i / slices;
          const envelope = Math.sin(ratio * Math.PI);
          const yOffset = Math.sin(ratio * Math.PI * 8.5 - phaseRef.current * 1.2) * 10 * (0.15 + volume * 0.85);
          const y = (height / 2) + (yOffset * envelope);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();

      } else if (isSpeaking) {
        // System synthesis voice output wave: vibrant blue wave
        const systemColor = "#3b82f6"; // Cyber blue
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(59, 130, 246, 0.5)";
        ctx.strokeStyle = systemColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const slices = 120;
        const sliceWidth = width / slices;
        let x = 0;

        for (let i = 0; i <= slices; i++) {
          const ratio = i / slices;
          const envelope = Math.sin(ratio * Math.PI);
          
          // Complex synthetic voice frequencies
          let yOffset = Math.sin(ratio * Math.PI * 6 + phaseRef.current * 1.8) * 18;
          yOffset += Math.sin(ratio * Math.PI * 14.5 + phaseRef.current * 0.8) * 5;
          const y = (height / 2) + (yOffset * envelope);
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();

      } else {
        // Standby wave: quiet, low-frequency subtle breathing charcoal wave
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const slices = 60;
        const sliceWidth = width / slices;
        let x = 0;

        for (let i = 0; i <= slices; i++) {
          const ratio = i / slices;
          const envelope = Math.sin(ratio * Math.PI);
          const yOffset = Math.sin(ratio * Math.PI * 2 + phaseRef.current * 0.3) * 3;
          const y = (height / 2) + (yOffset * envelope);
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, volume, isSpeaking]);

  return (
    <div id="visualizer-container" className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-800 bg-[#0c1017]">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div id="visualizer-overlay" className="absolute top-2 left-3 flex gap-2 items-center pointer-events-none">
        <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : isSpeaking ? "bg-blue-500 animate-pulse" : "bg-slate-500"}`} />
        <span className="text-[10px] font-mono text-slate-400 tracking-wider font-semibold uppercase">
          {isActive ? "STT Transcriber Live" : isSpeaking ? "Vocal Synthesis Speaking" : "Engine Standby"}
        </span>
      </div>
    </div>
  );
};
