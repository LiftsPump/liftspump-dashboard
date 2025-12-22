'use client';

import { useEffect, useRef } from 'react';

type BreathingDotsProps = {
  className?: string;
};

const BreathingDots = ({ className = '' }: BreathingDotsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // CONFIGURATION
    const DOT_SPACING = 20; // Distance between dots
    const DOT_SIZE = 1.5;   // Base radius
    const COLOR = '#22c55e'; // Your Tailwind green-500 hex
    
    // Create grid of dots
    const dots: { x: number; y: number; phase: number }[] = [];
    
    const initDots = () => {
      dots.length = 0; // Clear array
      const cols = Math.ceil(width / DOT_SPACING);
      const rows = Math.ceil(height / DOT_SPACING);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          dots.push({
            x: i * DOT_SPACING,
            y: j * DOT_SPACING,
            // Random phase so they don't all pulse at once (organic look)
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    initDots();

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const time = Date.now() / 1000;

      dots.forEach((dot) => {
        // "Breathing" math: Sine wave based on time + random phase
        // Opacity fluctuates between 0.1 and 0.5
        const alpha = (Math.sin(time + dot.phase) + 1) / 2 * 0.4 + 0.1;
        
        ctx.fillStyle = COLOR;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_SIZE, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(render);
    };

    render();

    // Handle Resize
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initDots();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
    className="block w-full h-full" 
    />
  );
};

export default BreathingDots;