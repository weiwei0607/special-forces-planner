import { useEffect, useRef } from 'react';

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeCtx = canvas.getContext('2d');
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    const DURATION = 2200;
    const startTime = performance.now();
    let frame = 0;
    let raf: number;

    // Grid settings
    const GRID = 32;
    const cols = Math.ceil(W / GRID) + 1;
    const rows = Math.ceil(H / GRID) + 1;

    // Scan line state
    let scanY = -GRID;

    // Cell activation: cells light up as scan passes
    type Cell = { col: number; row: number; lit: number; maxLit: number };
    const litCells: Cell[] = [];
    const cellMap: Record<string, number> = {};

    function draw(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION, 1);

      // BG
      ctx.fillStyle = '#070B09';
      ctx.fillRect(0, 0, W, H);

      // Grid lines (base)
      ctx.strokeStyle = 'rgba(245,158,11,0.06)';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * GRID, 0);
        ctx.lineTo(c * GRID, H);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * GRID);
        ctx.lineTo(W, r * GRID);
        ctx.stroke();
      }

      // Scan line advances
      const scanSpeed = H * 0.012;
      scanY += scanSpeed;

      // Ambient glow beneath scan line
      const glowH = 60;
      const glowGrd = ctx.createLinearGradient(0, scanY - glowH, 0, scanY + 20);
      glowGrd.addColorStop(0, 'transparent');
      glowGrd.addColorStop(0.7, `rgba(245,158,11,${0.04 + Math.sin(frame * 0.1) * 0.01})`);
      glowGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrd;
      ctx.fillRect(0, scanY - glowH, W, glowH + 20);

      // Scan line itself
      ctx.strokeStyle = `rgba(245,158,11,${0.7 + Math.sin(frame * 0.08) * 0.15})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(W, scanY);
      ctx.stroke();

      // Activate cells under scan line
      const scanRow = Math.floor(scanY / GRID);
      for (let c = 0; c < cols; c++) {
        const key = `${c},${scanRow}`;
        if (!cellMap[key] && Math.random() < 0.15) {
          cellMap[key] = 1;
          litCells.push({
            col: c, row: scanRow,
            lit: 1,
            maxLit: 0.06 + Math.random() * 0.12,
          });
        }
      }

      // Draw lit cells
      for (let i = litCells.length - 1; i >= 0; i--) {
        const cell = litCells[i];
        cell.lit -= 0.008;
        if (cell.lit <= 0) { litCells.splice(i, 1); continue; }

        const alpha = cell.lit * cell.maxLit;
        ctx.fillStyle = `rgba(245,158,11,${alpha})`;
        ctx.fillRect(cell.col * GRID + 1, cell.row * GRID + 1, GRID - 2, GRID - 2);
      }

      // Corner brackets (tactical frame)
      const BW = 36, BH = 36, BP = 24;
      const corners = [
        [BP, BP], [W - BP, BP], [W - BP, H - BP], [BP, H - BP]
      ] as const;
      const dirs = [
        [1, 1], [-1, 1], [-1, -1], [1, -1]
      ] as const;

      const bracketAlpha = Math.min(t * 3, 0.8);
      ctx.strokeStyle = `rgba(245,158,11,${bracketAlpha})`;
      ctx.lineWidth = 1.5;
      corners.forEach(([x, y], i) => {
        const [dx, dy] = dirs[i];
        ctx.beginPath();
        ctx.moveTo(x + dx * BW, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy * BH);
        ctx.stroke();
      });

      // Center crosshair
      const chAlpha = Math.min((t - 0.1) * 4, 0.5);
      if (chAlpha > 0) {
        ctx.strokeStyle = `rgba(245,158,11,${chAlpha})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245,158,11,${chAlpha * 1.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Title
      if (t > 0.3 && scanY > cy) {
        const textAlpha = Math.min((t - 0.3) / 0.35, 1) * (t < 0.78 ? 1 : (1 - t) * 4.5);
        ctx.save();
        ctx.globalAlpha = Math.max(0, textAlpha);
        ctx.font = `bold ${Math.round(W * 0.058)}px 'Space Mono', monospace`;
        ctx.fillStyle = '#F59E0B';
        ctx.textAlign = 'center';
        ctx.fillText('特種兵行程規劃', cx, cy - 12);
        ctx.font = `400 ${Math.round(W * 0.026)}px 'Space Mono', monospace`;
        ctx.fillStyle = 'rgba(245,158,11,0.55)';
        ctx.fillText('MISSION PLANNING SYSTEM', cx, cy + 20);
        ctx.restore();
      }

      // Fade out
      if (t > 0.78) {
        const fade = (t - 0.78) / 0.22;
        ctx.fillStyle = `rgba(7,11,9,${fade})`;
        ctx.fillRect(0, 0, W, H);
      }

      frame++;
      if (t < 1) {
        raf = requestAnimationFrame(draw);
      } else {
        onDone();
      }
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] cursor-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
