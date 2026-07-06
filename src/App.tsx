import React, { useState, useRef, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ParticleCanvas from './components/ParticleCanvas';

const ANIMATIONS = [
  'fade-in', 'slide-left', 'slide-right', 'zoom-in',
  'rotate-full', 'rotate-diag', 'flip-in', 'bounce-in', 'heart-beat',
  'star-shape', 'heart-shape', 'circle-shape', 'diamond-shape',
  'pentagon-shape', 'hexagon-shape',
  'explosion-flash', 'spiral-in', 'swing-in',
  'flip-vertical', 'morph-blur',
];

const SLIDE_INTERVAL = 3500;

type RingType = 'circle' | 'square' | 'heart';

interface PulseRingData {
  id: number;
  type: RingType;
}

interface SavedAlbum {
  id: string;
  title: string;
  creator: string;
  images: string[];
  music: string | null;
  musicName: string | null;
  createdAt: number;
}

export default function App() {
  const [images, setImages] = useState<{ file: File | null; url: string }[]>([]);
  const [musicFile, setMusicFile] = useState<{ file: File | null; url: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentAnimation, setCurrentAnimation] = useState('fade-in');
  const [toast, setToast] = useState<string | null>(null);
  const [pulseRings, setPulseRings] = useState<PulseRingData[]>([]);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);
  const [shimmerLines, setShimmerLines] = useState<{ id: number; y: number }[]>([]);

  // Metadata states for creation
  const [albumTitle, setAlbumTitle] = useState('آلبوم آریامهر');
  const [creatorName, setCreatorName] = useState('آیدین سعیدی');

  // Server library & sharing states
  const [serverAlbums, setServerAlbums] = useState<SavedAlbum[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoadingShared, setIsLoadingShared] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // Set audio source when musicFile changes
  useEffect(() => {
    if (musicFile && audioRef.current) {
      audioRef.current.src = musicFile.url;
    }
  }, [musicFile]);

  // Toast helper
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Fetch server albums on mount
  const fetchServerAlbums = useCallback(async () => {
    try {
      const response = await fetch('/api/albums');
      if (response.ok) {
        const data = await response.json();
        setServerAlbums(data);
      }
    } catch (e) {
      console.error("Failed to load server albums:", e);
    }
  }, []);

  // Image Resizer/Compressor to convert images to highly lightweight Base64 to solve the dead Blob URL bug
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Export as compressed JPEG to conserve space
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          resolve(dataUrl);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Convert custom audio to Base64 to make it savable on the server side
  const audioToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Handle URL Share Code Check on startup
  useEffect(() => {
    const checkSharedAlbum = async () => {
      const params = new URLSearchParams(window.location.search);
      const albumId = params.get('id');
      if (albumId) {
        setIsLoadingShared(true);
        showToast('🔄 در حال بارگذاری آلبوم اشتراکی...');
        try {
          const response = await fetch(`/api/albums/${albumId}`);
          if (response.ok) {
            const album: SavedAlbum = await response.json();
            setAlbumTitle(album.title);
            setCreatorName(album.creator);

            // Set images using URLs served statically by the backend
            setImages(album.images.map(url => ({ file: null, url })));
            
            if (album.music) {
              setMusicFile({ file: null, url: album.music });
            } else {
              setMusicFile(null);
            }
            showToast(`💖 آلبوم "${album.title}" با موفقیت بارگذاری شد!`);
            
            // Auto start playing
            setTimeout(() => {
              setIsPlaying(true);
              if (audioRef.current && album.music) {
                audioRef.current.src = album.music;
                audioRef.current.play().catch(() => {});
              }
              setCurrentSlide(0);
              setCurrentAnimation('fade-in');
              intervalRef.current = window.setInterval(() => {
                setCurrentSlide(prev => (prev + 1) % album.images.length);
                setCurrentAnimation(ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)]);
              }, SLIDE_INTERVAL);
            }, 1000);
          } else {
            showToast('❌ آلبوم اشتراکی یافت نشد یا حذف شده است');
          }
        } catch (error) {
          console.error("Error loading shared album:", error);
          showToast('❌ خطا در ارتباط با سرور جهت دریافت آلبوم');
        } finally {
          setIsLoadingShared(false);
        }
      }
    };

    fetchServerAlbums();
    checkSharedAlbum();
  }, [fetchServerAlbums, showToast]);

  // Continuous sparkles while playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSparkles(prev => [
        ...prev.slice(-20),
        {
          id: Date.now() + Math.random(),
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
        }
      ]);
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Floating hearts while playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const emojis = ['💖', '💗', '💝', '💕', '✨', '💫', '⭐', '🌟'];
      setFloatingHearts(prev => [
        ...prev.slice(-10),
        {
          id: Date.now() + Math.random(),
          x: Math.random() * window.innerWidth,
          y: window.innerHeight * 0.5 + Math.random() * window.innerHeight * 0.3,
          emoji: emojis[Math.floor(Math.random() * emojis.length)],
        }
      ]);
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Shimmer lines
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setShimmerLines(prev => [
        ...prev.slice(-5),
        {
          id: Date.now() + Math.random(),
          y: Math.random() * window.innerHeight,
        }
      ]);
    }, 800);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    showToast('🔄 در حال پردازش و بهینه‌سازی تصاویر...');
    const uploadedArray: File[] = Array.from(files);
    const newImages: { file: File | null; url: string }[] = [];

    for (const file of uploadedArray) {
      try {
        const compressedBase64 = await compressImage(file);
        newImages.push({
          file,
          url: compressedBase64,
        });
      } catch (err) {
        console.error("Error compressing image:", err);
      }
    }

    setImages(prev => [...prev, ...newImages]);
    showToast(`💖 ${newImages.length} عکس با موفقیت بهینه و اضافه شد!`);
    if (e.target) e.target.value = '';
  }, [showToast]);

  const handleMusicUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (audioRef.current) audioRef.current.pause();
    const url = URL.createObjectURL(file);
    setMusicFile({ file, url });
    showToast(`🎵 آهنگ "${file.name}" اضافه شد!`);
    if (e.target) e.target.value = '';
  }, [showToast]);

  const triggerSlideEffects = useCallback(() => {
    const ringTypes: RingType[] = ['circle', 'square', 'heart'];
    setPulseRings(ringTypes.map((t, i) => ({ id: Date.now() + i, type: t })));
    setTimeout(() => setPulseRings([]), 2500);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide(prev => (prev + 1) % images.length);
    setCurrentAnimation(ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)]);
    triggerSlideEffects();
  }, [images.length, triggerSlideEffects]);

  const startPlayback = useCallback(() => {
    if (images.length === 0) {
      showToast('⚠️ لطفاً ابتدا عکس‌ها را اضافه کنید');
      return;
    }
    setIsPlaying(true);
    setMenuOpen(false);

    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        showToast('🔊 برای پخش موسیقی یکبار روی صفحه کلیک کنید');
      });
    }

    setCurrentSlide(0);
    setCurrentAnimation(ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)]);
    triggerSlideEffects();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = window.setInterval(() => {
      nextSlide();
    }, SLIDE_INTERVAL);
  }, [images.length, nextSlide, showToast, triggerSlideEffects]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPulseRings([]);
    setMenuOpen(false);
    showToast('⏹️ نمایش متوقف شد');
  }, [showToast]);

  // Cloud Save & Zip Download Integration
  const handleSave = useCallback(async () => {
    if (images.length === 0) {
      showToast('⚠️ محتوایی برای ذخیره وجود ندارد');
      return;
    }
    setIsSaving(true);
    showToast('💾 در حال ذخیره‌سازی ابری و ساخت فایل زیپ...');

    try {
      // 1. First, package the local ZIP to fulfill their offline-download feature!
      const zip = new JSZip();
      const folder = zip.folder('آلبوم-شاهنشاه-آریا-مهر');
      const imgFolder = folder!.folder('images');
      
      for (let i = 0; i < images.length; i++) {
        const response = await fetch(images[i].url);
        const blob = await response.blob();
        imgFolder!.file(`photo_${i + 1}.jpg`, blob);
      }

      if (musicFile) {
        const musicFolder = folder!.folder('music');
        const response = await fetch(musicFile.url);
        const blob = await response.blob();
        musicFolder!.file('music.mp3', blob);
      }

      folder!.file('README.txt',
        `💖 آلبوم شاهنشاه آریا مهر: ${albumTitle} 💖\n` +
        '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        `تعداد عکس: ${images.length}\n` +
        `موسیقی: ${musicFile ? (musicFile.file ? musicFile.file.name : 'آهنگ بارگذاری شده') : 'ندارد'}\n\n` +
        `سازنده: ${creatorName}\n` +
        `Made with ❤️ by ${creatorName}\n` +
        '━━━━━━━━━━━━━━━━━━━━━━\n' +
        'این آلبوم با عشق ساخته شده 💖'
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${albumTitle.replace(/\s+/g, '_')}.zip`);

      // 2. Second, save to the full-stack database so that it's permanently stored on the server!
      let audioBase64: string | null = null;
      if (musicFile && musicFile.url.startsWith("blob:")) {
        // Fetch audio blob and convert to Base64
        const audioResponse = await fetch(musicFile.url);
        const audioBlob = await audioResponse.blob();
        audioBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      } else if (musicFile && musicFile.url.startsWith("/uploads/")) {
        audioBase64 = musicFile.url;
      }

      const savePayload = {
        title: albumTitle,
        creator: creatorName,
        images: images.map(img => img.url), // Base64 or URLs
        music: audioBase64,
        musicName: musicFile && musicFile.file ? musicFile.file.name : "music.mp3"
      };

      const serverResponse = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload)
      });

      if (serverResponse.ok) {
        const result = await serverResponse.json();
        const shareUrl = `${window.location.origin}${window.location.pathname}?id=${result.album.id}`;
        setShareLink(shareUrl);
        showToast('✅ ذخیره‌سازی ابری با موفقیت انجام شد!');
        fetchServerAlbums();
      } else {
        showToast('⚠️ زیپ ساخته شد اما خطا در ذخیره‌سازی روی سرور رخ داد');
      }
    } catch (e) {
      console.error(e);
      showToast('❌ خطا در ذخیره‌سازی');
    } finally {
      setIsSaving(false);
    }
  }, [images, musicFile, albumTitle, creatorName, showToast, fetchServerAlbums]);

  const loadLocalAlbum = useCallback((album: SavedAlbum) => {
    setAlbumTitle(album.title);
    setCreatorName(album.creator);
    setImages(album.images.map(url => ({ file: null, url })));
    if (album.music) {
      setMusicFile({ file: null, url: album.music });
    } else {
      setMusicFile(null);
    }
    stopPlayback();
    setMenuOpen(false);
    showToast(`📂 آلبوم "${album.title}" با موفقیت بارگذاری شد!`);
  }, [showToast, stopPlayback]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const barDelays = Array.from({ length: 20 }, (_, i) => i * 0.07);

  const ringSizes = [
    { w: 500, h: 500 },
    { w: 600, h: 600 },
    { w: 700, h: 700 },
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0a0a0a' }}>
      {/* Hidden inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
      <input ref={musicInputRef} type="file" accept="audio/*" onChange={handleMusicUpload} style={{ display: 'none' }} />
      <audio ref={audioRef} loop hidden />

      {/* Rainbow Background */}
      <div className="rainbow-bg" />

      {/* Rotating Rings */}
      {ringSizes.map((size, i) => (
        <div
          key={i}
          className="rotating-ring"
          style={{
            width: size.w,
            height: size.h,
          }}
        />
      ))}

      {/* Light Beams */}
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="light-beam"
          style={{
            left: `${(i / 16) * 100}%`,
            background: `linear-gradient(to bottom, transparent, ${['#ff6b9d', '#c44dff', '#6b9dff', '#ffd700', '#00ff88', '#ff4444', '#ff9ff3', '#48dbfb'][i % 8]}, transparent)`,
            animationDelay: `${i * 0.25}s`,
            animationDuration: `${2.5 + (i % 3)}s`,
          }}
        />
      ))}

      {/* Glow Orbs */}
      <div className="glow-orb" style={{ width: '350px', height: '350px', top: '5%', left: '5%', background: 'radial-gradient(circle, rgba(255,50,100,0.35), transparent)', animationDelay: '0s' }} />
      <div className="glow-orb" style={{ width: '450px', height: '450px', top: '45%', right: '5%', background: 'radial-gradient(circle, rgba(100,50,255,0.25), transparent)', animationDelay: '2s' }} />
      <div className="glow-orb" style={{ width: '300px', height: '300px', bottom: '5%', left: '35%', background: 'radial-gradient(circle, rgba(50,200,255,0.25), transparent)', animationDelay: '4s' }} />
      <div className="glow-orb" style={{ width: '400px', height: '400px', top: '25%', left: '55%', background: 'radial-gradient(circle, rgba(255,200,50,0.18), transparent)', animationDelay: '1s' }} />
      <div className="glow-orb" style={{ width: '250px', height: '250px', top: '65%', left: '15%', background: 'radial-gradient(circle, rgba(0,255,150,0.2), transparent)', animationDelay: '3s' }} />
      <div className="glow-orb" style={{ width: '200px', height: '200px', top: '15%', right: '25%', background: 'radial-gradient(circle, rgba(255,100,200,0.25), transparent)', animationDelay: '1.5s' }} />

      {/* Particle Canvas */}
      <ParticleCanvas isActive={true} />

      {/* Sparkles */}
      {sparkles.map(s => (
        <div key={s.id} className="sparkle" style={{ left: s.x, top: s.y }} />
      ))}

      {/* Floating Hearts */}
      {floatingHearts.map(h => (
        <div key={h.id} className="floating-heart" style={{ left: h.x, top: h.y, fontSize: '28px' }}>
          {h.emoji}
        </div>
      ))}

      {/* Shimmer Lines */}
      {shimmerLines.map(s => (
        <div
          key={s.id}
          className="shimmer-line"
          style={{ top: s.y, left: 0, width: '100%' }}
        />
      ))}

      {/* Pulse Rings */}
      {pulseRings.map(ring => {
        if (ring.type === 'circle') {
          return <div key={ring.id} className="pulse-ring" />;
        } else if (ring.type === 'square') {
          return <div key={ring.id} className="pulse-ring-square" />;
        } else {
          return <div key={ring.id} className="pulse-ring-heart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💖</div>;
        }
      })}

      {/* Slideshow */}
      {isPlaying && images.length > 0 && (
        <div className="slideshow-container">
          <div className="image-glow-frame" />
          <img
            key={currentSlide}
            src={images[currentSlide % images.length].url}
            alt={`Slide ${currentSlide + 1}`}
            className={`slideshow-image ${currentAnimation}`}
          />
        </div>
      )}

      {/* Loading Shared State */}
      {isLoadingShared && (
        <div className="welcome-screen" style={{ background: 'rgba(5, 0, 10, 0.85)', zIndex: 110 }}>
          <div className="animate-spin" style={{ fontSize: '60px', marginBottom: '24px' }}>💖</div>
          <div className="welcome-title" style={{ fontSize: '24px' }}>در حال بارگیری آلبوم از فضای ابری...</div>
        </div>
      )}

      {/* Welcome Screen */}
      {!isPlaying && images.length === 0 && (
        <div className="welcome-screen" style={{ direction: 'rtl' }}>
          <div style={{
            fontSize: '90px', marginBottom: '24px',
            animation: 'heartBeat 2s ease infinite',
          }}>👑</div>
          <div className="welcome-title">{albumTitle}</div>
          <div className="welcome-subtitle">✨ آلبوم دیجیتال خاطرات ✨</div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 215, 0, 0.15)',
            borderRadius: '16px',
            padding: '20px',
            marginTop: '20px',
            maxWidth: '380px',
            width: '90%',
            display: 'flex',
            flexDirection: 'col',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: 'rgba(255,215,0,0.8)', fontSize: '12px', fontWeight: 'bold' }}>نام آلبوم شما:</label>
              <input 
                type="text" 
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
              <label style={{ color: 'rgba(255,215,0,0.8)', fontSize: '12px', fontWeight: 'bold' }}>نام طراح و سازنده:</label>
              <input 
                type="text" 
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '8px', marginTop: '20px' }}>
            منوی همبرگری بالا سمت چپ را لمس کنید و عکس‌ها و موسیقی دلخواهتان را اضافه کنید ✨
          </p>
          
          <div className="welcome-creator" style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,215,0,0.4)', marginBottom: '6px' }}>طراحی شده با عشق ❤️ توسط</div>
            <div style={{
              fontSize: '22px', fontWeight: 800,
              background: 'linear-gradient(135deg, #ffd700, #ff6b9d, #c44dff, #6b9dff)',
              backgroundSize: '300% 300%',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: 'rainbowText 3s ease infinite',
            }}>
              {creatorName}
            </div>
          </div>
        </div>
      )}

      {/* Ready Screen */}
      {images.length > 0 && !isPlaying && (
        <div className="welcome-screen" style={{ background: 'rgba(5, 0, 10, 0.55)' }}>
          <div style={{ fontSize: '60px', marginBottom: '16px', animation: 'bounceIn 1s ease infinite' }}>✨</div>
          <div style={{
            fontSize: '26px', fontWeight: 800,
            background: 'linear-gradient(135deg, #ffd700, #ff6b9d, #c44dff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}>
            آلبوم آماده است
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', marginBottom: '8px' }}>
            {images.length} تصویر زیبا 💖 {musicFile && '🎵 آهنگ شخصی شما'} آماده پخش است
          </p>
          <button 
            onClick={startPlayback}
            style={{
              padding: '12px 30px',
              borderRadius: '30px',
              background: 'linear-gradient(135deg, #ff3264, #c832ff)',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              marginTop: '15px',
              boxShadow: '0 0 20px rgba(255,50,100,0.4)',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ▶️ شروع پخش آلبوم خاطرات
          </button>
        </div>
      )}

      {/* Image Counter */}
      {isPlaying && images.length > 0 && (
        <div className="image-counter">
          ✨ {currentSlide + 1} / {images.length} ✨
        </div>
      )}

      {/* Music Visualizer Bars */}
      <div className={`music-bars ${isPlaying && musicFile ? 'active' : ''}`}>
        {barDelays.map((delay, i) => (
          <div
            key={i}
            className="music-bar"
            style={{
              animationDelay: `${delay}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>

      {/* Hamburger Button */}
      <button
        className={`hamburger-btn ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          boxShadow: menuOpen ? 'none' : '0 0 20px rgba(255,215,0,0.15)',
        }}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Menu Overlay */}
      <div
        className={`menu-overlay ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Side Menu */}
      <div className={`side-menu ${menuOpen ? 'open' : ''}`} style={{ direction: 'rtl', textAlign: 'right' }}>
        <div className="menu-title">👑 منوی استودیوی آلبوم 👑</div>

        {/* 1. Upload Images */}
        <button className="menu-btn" onClick={() => { imageInputRef.current?.click(); setMenuOpen(false); }}>
          <span className="icon">📸</span>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold' }}>اضافه کردن عکس</div>
            {images.length > 0 && (
              <div className="info-badge">🖼️ {images.length} عکس بارگذاری شده</div>
            )}
          </div>
        </button>

        {/* Image thumbnails */}
        {images.length > 0 && (
          <div style={{
            display: 'flex', gap: '5px', flexWrap: 'wrap', padding: '6px',
            marginBottom: '8px', maxHeight: '100px', overflowY: 'auto',
          }}>
            {images.slice(0, 12).map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt=""
                style={{
                  width: '45px', height: '45px', borderRadius: '8px',
                  objectFit: 'cover', border: isPlaying && currentSlide === i % images.length ? '2px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                  transition: 'border 0.3s',
                  boxShadow: isPlaying && currentSlide === i % images.length ? '0 0 10px rgba(255,215,0,0.3)' : 'none',
                }}
              />
            ))}
            {images.length > 12 && (
              <div style={{
                width: '45px', height: '45px', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: '12px',
              }}>
                +{images.length - 12}
              </div>
            )}
          </div>
        )}

        {/* 2. Upload Music */}
        <button className="menu-btn" onClick={() => { musicInputRef.current?.click(); setMenuOpen(false); }}>
          <span className="icon">🎵</span>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold' }}>اضافه کردن آهنگ ملودی</div>
            {musicFile && (
              <div className="info-badge" style={{ direction: 'ltr' }}>🎶 {(musicFile.file ? musicFile.file.name : "آهنگ انتخابی").substring(0, 18)}...</div>
            )}
          </div>
        </button>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,215,0,0.15)', margin: '14px 0' }} />

        {/* 3. Play */}
        <button className="menu-btn play-btn" onClick={startPlayback}>
          <span className="icon">▶️</span>
          <span>{isPlaying ? '🌟 در حال پخش آلبوم...' : 'شروع پخش نمایش'}</span>
        </button>

        {/* 4. Stop */}
        <button className="menu-btn stop-btn" onClick={stopPlayback}>
          <span className="icon">⏹️</span>
          <span>توقف پخش</span>
        </button>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(100,200,255,0.15)', margin: '14px 0' }} />

        {/* 5. Save & Cloud Upload */}
        <button 
          className="menu-btn save-btn" 
          onClick={handleSave} 
          disabled={isSaving}
          style={{ opacity: isSaving ? 0.6 : 1 }}
        >
          <span className="icon">{isSaving ? '⏳' : '💾'}</span>
          <span>{isSaving ? 'در حال ذخیره ابری...' : 'ذخیره ابری و دانلود آلبوم'}</span>
        </button>

        {/* Clear all */}
        {(images.length > 0 || musicFile) && (
          <button
            className="menu-btn"
            onClick={() => {
              images.forEach(img => {
                if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
              });
              setImages([]);
              if (musicFile) {
                if (musicFile.url.startsWith("blob:")) URL.revokeObjectURL(musicFile.url);
                setMusicFile(null);
              }
              stopPlayback();
              showToast('🗑️ همه محتوا پاک شد');
            }}
            style={{ background: 'rgba(255,50,50,0.08)', marginTop: '5px' }}
          >
            <span className="icon">🗑️</span>
            <span style={{ color: 'rgba(255,100,100,0.8)' }}>حذف کل عکس‌ها و آهنگ</span>
          </button>
        )}

        {/* Server Public Albums Library */}
        {serverAlbums.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,215,0,0.7)', marginBottom: '10px', borderBottom: '1px solid rgba(255,215,0,0.2)', paddingBottom: '4px', fontWeight: 'bold' }}>
              🌟 آلبوم‌های ذخیره شده ابری:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
              {serverAlbums.map((alb) => (
                <div 
                  key={alb.id} 
                  onClick={() => loadLocalAlbum(alb)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(255,100,150,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                    🖼️
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{alb.title}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>طراح: {alb.creator} • {alb.images.length} عکس</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creator Badge */}
        <div className="creator-badge" style={{ marginTop: '30px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,215,0,0.3)', marginBottom: '8px' }}>
            ساخته شده با ❤️ توسط
          </div>
          <div className="name">{creatorName}</div>
          <div className="title">شاهنشاه آریا مهر</div>
          <div style={{
            fontSize: '10px', color: 'rgba(255,255,255,0.2)',
            marginTop: '10px', lineHeight: '1.6',
          }}>
            Love Album v3.0 Cloud 💖
          </div>
        </div>
      </div>

      {/* Share Modal for Share Link */}
      {shareLink && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.85)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            direction: 'rtl'
          }}
        >
          <div 
            style={{
              background: '#150a20',
              border: '2px solid rgba(255, 215, 0, 0.4)',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '450px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(255,215,0,0.2)'
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎉</div>
            <h3 style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginBottom: '10px' }}>آلبوم شما در ابر ذخیره شد!</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
              لینک اختصاصی زیر ساخته شد. شما می‌توانید این لینک را برای دوستان، خانواده یا عشق خود ارسال کنید تا بلافاصله آلبوم موزیکال زیبای شما را با موزیک و رقص تصاویر تماشا کنند!
            </p>
            
            <div 
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '13px',
                color: '#ffd700',
                wordBreak: 'break-all',
                direction: 'ltr',
                marginBottom: '20px',
                userSelect: 'all'
              }}
            >
              {shareLink}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  showToast('📋 لینک در حافظه کپی شد!');
                }}
                style={{
                  background: 'linear-gradient(135deg, #ffd700, #ffb700)',
                  color: 'black',
                  fontWeight: 'bold',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                📋 کپی لینک اشتراک
              </button>
              <button
                onClick={() => setShareLink(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
