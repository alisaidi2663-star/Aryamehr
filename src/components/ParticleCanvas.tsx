import { useEffect, useRef, useCallback } from 'react';

interface ParticleCanvasProps {
  isActive: boolean;
}

interface Heart {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  type: 'heart' | 'bubble' | 'sparkle';
}

const HEART_COLORS = [
  '#ff6b9d', '#ff3366', '#ff0055', '#ff85a2',
  '#ff4d8d', '#e91e63', '#ff1744', '#f50057',
  '#ff6090', '#c44dff', '#6b9dff', '#ff9ff3',
];

const BUBBLE_COLORS = [
  'rgba(255, 107, 157, 0.4)', 'rgba(196, 77, 255, 0.4)',
  'rgba(107, 157, 255, 0.4)', 'rgba(255, 215, 0, 0.3)',
  'rgba(0, 255, 200, 0.3)', 'rgba(255, 100, 100, 0.3)',
  'rgba(100, 255, 100, 0.3)', 'rgba(200, 100, 255, 0.3)',
];

export default function ParticleCanvas({ isActive }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Heart[]>([]);
  const animationRef = useRef<number>(0);

  const drawHeart = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rotation: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.beginPath();
    const s = size / 2;
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(-s, -s * 0.5, -s * 0.5, -s * 1.5, 0, -s * 0.8);
    ctx.bezierCurveTo(s * 0.5, -s * 1.5, s, -s * 0.5, 0, s * 0.3);
    ctx.fill();
    ctx.restore();
  }, []);

  const drawBubble = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.6)');
    ctx.lineWidth = 1;
    ctx.stroke();
    // Highlight
    ctx.beginPath();
    ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
    ctx.restore();
  }, []);

  const drawSparkle = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rotation: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.ellipse(0, size, size * 0.2, size, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }, []);

  const createHeartExplosion = useCallback((x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      particlesRef.current.push({
        x, y,
        size: 8 + Math.random() * 16,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        opacity: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
        type: 'heart',
      });
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      particlesRef.current = [];
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initial particles
    const spawnInitialParticles = () => {
      for (let i = 0; i < 30; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + Math.random() * 200,
          size: 10 + Math.random() * 25,
          speedX: (Math.random() - 0.5) * 1.5,
          speedY: -1 - Math.random() * 2.5,
          opacity: 0.6 + Math.random() * 0.4,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.05,
          color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
          type: 'heart',
        });
      }
      for (let i = 0; i < 50; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + Math.random() * 300,
          size: 5 + Math.random() * 20,
          speedX: (Math.random() - 0.5) * 1,
          speedY: -0.5 - Math.random() * 2,
          opacity: 0.3 + Math.random() * 0.5,
          rotation: 0,
          rotationSpeed: 0,
          color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
          type: 'bubble',
        });
      }
    };
    spawnInitialParticles();

    // Continuous spawning
    const spawnInterval = setInterval(() => {
      if (particlesRef.current.length < 200) {
        // Hearts
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 20,
          size: 8 + Math.random() * 18,
          speedX: (Math.random() - 0.5) * 1.5,
          speedY: -1 - Math.random() * 2,
          opacity: 0.5 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.05,
          color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
          type: 'heart',
        });
        // Bubbles
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 20,
          size: 5 + Math.random() * 15,
          speedX: (Math.random() - 0.5) * 0.8,
          speedY: -0.5 - Math.random() * 1.5,
          opacity: 0.2 + Math.random() * 0.4,
          rotation: 0,
          rotationSpeed: 0,
          color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
          type: 'bubble',
        });
        // Sparkles
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: 3 + Math.random() * 8,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          opacity: 0.5 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.1,
          color: '#ffffff',
          type: 'sparkle',
        });
      }
    }, 300);

    // Heart explosions periodically
    const explosionInterval = setInterval(() => {
      createHeartExplosion(
        Math.random() * canvas.width,
        Math.random() * canvas.height * 0.6,
        8 + Math.floor(Math.random() * 8)
      );
    }, 2000);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.002;

        if (p.type === 'bubble') {
          p.speedX += (Math.random() - 0.5) * 0.05;
        }

        if (p.opacity <= 0 || p.y < -50 || p.x < -50 || p.x > canvas.width + 50) {
          return false;
        }

        ctx.globalAlpha = Math.max(0, p.opacity);

        if (p.type === 'heart') {
          drawHeart(ctx, p.x, p.y, p.size, p.color, p.rotation);
        } else if (p.type === 'bubble') {
          drawBubble(ctx, p.x, p.y, p.size, p.color);
        } else {
          drawSparkle(ctx, p.x, p.y, p.size, p.color, p.rotation);
        }

        return true;
      });

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
      clearInterval(spawnInterval);
      clearInterval(explosionInterval);
      particlesRef.current = [];
    };
  }, [isActive, createHeartExplosion, drawBubble, drawHeart, drawSparkle]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
        pointerEvents: 'none',
      }}
    />
  );
}
