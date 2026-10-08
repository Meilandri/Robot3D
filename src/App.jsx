import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Wrench, Send, X, History, MessageCircle, Plus, Trash2, Copy, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import arduino from 'highlight.js/lib/languages/arduino';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import 'highlight.js/styles/github-dark.css';

const STORAGE_KEY = 'robocraft_sessions';
const MAX_SESSIONS = 30;
const GREETING = { sender: 'bot', text: 'Halo! Ada yang bisa kubantu hari ini?' };

const newId = () => `chat_${Date.now()}`;

const loadSessions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const formatTanggal = (ms) =>
  new Date(ms).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const cariTrackHips = (clip) =>
  clip.tracks.find((t) => /(hips|pelvis)\.position$/i.test(t.name));

const samakanPosisiHips = (clip, acuan) => {
  const track = cariTrackHips(clip);
  const trackAcuan = cariTrackHips(acuan);
  if (!track || !trackAcuan) return;
  const v = track.values;
  const a = trackAcuan.values;
  const dx = v[0] - a[0];
  const dy = v[1] - a[1];
  const dz = v[2] - a[2];
  for (let i = 0; i < v.length; i += 3) {
    v[i] -= dx;
    v[i + 1] -= dy;
    v[i + 2] -= dz;
  }
};

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('arduino', arduino);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);

function salinTeks(teks) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(teks);
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = teks;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error('Perintah copy ditolak browser'));
    } catch (err) {
      reject(err);
    }
  });
}

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    if (!lang || !hljs.getLanguage(lang)) return null;
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } catch {
      return null;
    }
  }, [code, lang]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await salinTeks(code);
      setCopied(true);
    } catch (err) {
      console.error('Gagal menyalin kode:', err);
    }
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 text-left">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <span className="text-xs text-slate-300 font-mono truncate">{lang || 'kode'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Kode tersalin' : 'Salin kode'}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white rounded px-1.5 py-0.5 hover:bg-slate-700 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Tersalin' : 'Salin'}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto px-3 py-2.5 text-xs leading-relaxed text-slate-100">
        {html ? (
          <code className="font-mono" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code className="font-mono">{code}</code>
        )}
      </pre>
    </div>
  );
}

function PreBlock({ children }) {
  const el = Array.isArray(children) ? children[0] : children;
  const className = el?.props?.className || '';
  const lang = /language-([\w+#-]+)/.exec(className)?.[1];
  const raw = el?.props?.children;
  const code = (Array.isArray(raw) ? raw.join('') : String(raw ?? '')).replace(/\n$/, '');
  return <CodeBlock code={code} lang={lang} />;
}

const mdComponents = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 pl-5 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 pl-5 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline underline-offset-2 break-words">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="my-1.5 pl-3 border-l-2 border-slate-300 text-slate-600">{children}</blockquote>,
  hr: () => <hr className="my-2 border-slate-300" />,
  table: ({ children }) => <div className="my-2 overflow-x-auto"><table className="text-xs border-collapse">{children}</table></div>,
  th: ({ children }) => <th className="border border-slate-300 bg-slate-200/70 px-2 py-1 text-left font-bold">{children}</th>,
  td: ({ children }) => <td className="border border-slate-300 px-2 py-1">{children}</td>,
  pre: PreBlock,
  code: ({ children }) => <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-800 text-[0.85em] font-mono break-words">{children}</code>,
};

export default function App() {
  const mountRef = useRef(null);
  const listRef = useRef(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [comicBubble, setComicBubble] = useState('Halo! Ada yang bisa kubantu?');

  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([GREETING]);

  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(newId);

  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  const currentActionRef = useRef(null);
  const currentModeRef = useRef(null);
  const talkTimerRef = useRef(null);
  const bubbleTimerRef = useRef(null);

  const playAnimation = useCallback((name) => {
    const next = actionsRef.current[name];
    if (!next) return;
    const prev = currentActionRef.current;
    currentModeRef.current = name;
    if (prev === next) return;
    if (prev) prev.fadeOut(0.4);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.4).play();
    currentActionRef.current = next;
  }, []);

  const speak = useCallback(
    (text) => {
      clearTimeout(talkTimerRef.current);
      clearTimeout(bubbleTimerRef.current);
      setComicBubble(text);
      playAnimation('talking');
      const durasi = Math.min(Math.max(text.length * 60, 2500), 15000);
      talkTimerRef.current = setTimeout(() => {
        playAnimation('idle');
        setComicBubble(null);
      }, durasi);
    },
    [playAnimation]
  );

  const resetRobot = useCallback(() => {
    clearTimeout(talkTimerRef.current);
    clearTimeout(bubbleTimerRef.current);
    playAnimation('idle');
    setComicBubble(null);
  }, [playAnimation]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let animationFrameId;
    let model = null;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.2, 4.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.minPolarAngle = Math.PI / 2.2;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.enablePan = false;
    controls.enableZoom = false;

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(5, 12, 8);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xbde0fe, 1.0);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e) => {
      const geser = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (geser > 5 || !model) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const kena = raycaster.intersectObject(model, true);
      if (kena.length > 0) {
        const mode = currentModeRef.current;
        if (mode !== 'talking' && mode !== 'waving') {
          playAnimation('waving');
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    const clock = new THREE.Timer();

    Promise.all([
      gltfLoader.loadAsync('/models/idle.glb'),
      gltfLoader.loadAsync('/models/wave.glb'),
      gltfLoader.loadAsync('/models/talking.glb'),
    ])
      .then(([idleGltf, waveGltf, talkGltf]) => {
        if (disposed) return;
        const object = idleGltf.scene;
        object.traverse((child) => {
          if (child.isMesh) child.frustumCulled = false;
        });

        object.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const tinggiTarget = 2.4;
        const skala = tinggiTarget / size.y;
        object.scale.setScalar(skala);
        object.position.set(-center.x * skala, -box.min.y * skala - 1.25, -center.z * skala);

        scene.add(object);
        model = object;

        const mixer = new THREE.AnimationMixer(object);
        mixerRef.current = mixer;

        const idleClip = idleGltf.animations[0];
        const waveClip = waveGltf.animations[0];
        const talkClip = talkGltf.animations[0];
        samakanPosisiHips(waveClip, idleClip);
        samakanPosisiHips(talkClip, idleClip);

        const idleAction = mixer.clipAction(idleClip);
        idleAction.setLoop(THREE.LoopRepeat, Infinity);

        const waveAction = mixer.clipAction(waveClip);
        waveAction.setLoop(THREE.LoopOnce, 1);
        waveAction.clampWhenFinished = true;

        const talkAction = mixer.clipAction(talkClip);
        talkAction.setLoop(THREE.LoopRepeat, Infinity);

        actionsRef.current = {
          idle: idleAction,
          waving: waveAction,
          talking: talkAction,
        };

        mixer.addEventListener('finished', (e) => {
          if (e.action === waveAction && currentModeRef.current === 'waving') {
            playAnimation('idle');
          }
        });

        playAnimation('waving');
      })
      .catch((err) => {
        console.error('Gagal memuat model:', err);
      });

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      clock.update();
      const delta = clock.getDelta();
      if (mixerRef.current) mixerRef.current.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    bubbleTimerRef.current = setTimeout(() => setComicBubble(null), 5000);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      clearTimeout(talkTimerRef.current);
      clearTimeout(bubbleTimerRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);

      if (mixerRef.current) mixerRef.current.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
      currentActionRef.current = null;
      currentModeRef.current = null;

      controls.dispose();
      dracoLoader.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [playAnimation]);

  useEffect(() => {
    const pertanyaanPertama = messages.find((m) => m.sender === 'user');
    if (!pertanyaanPertama) return;

    setSessions((prev) => {
      const ada = prev.find((s) => s.id === activeId);
      if (ada && ada.messages.length === messages.length) return prev;

      const entri = {
        id: activeId,
        title: pertanyaanPertama.text.slice(0, 40),
        updatedAt: Date.now(),
        messages,
      };
      return [entri, ...prev.filter((s) => s.id !== activeId)].slice(0, MAX_SESSIONS);
    });
  }, [messages, activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch { }
  }, [sessions]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading, isLogOpen]);

  const startNewChat = () => {
    if (isLoading) return;
    resetRobot();
    setActiveId(newId());
    setMessages([GREETING]);
    setIsHistoryOpen(false);
  };

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const handleClearChat = () => {
    if (isLoading || messages.length <= 1) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    resetRobot();
    setSessions((prev) => prev.filter((s) => s.id !== activeId));
    setActiveId(newId());
    setMessages([GREETING]);
    setChatInput('');
    setComicBubble('Chat sudah bersih. Mau tanya apa lagi?');
    bubbleTimerRef.current = setTimeout(() => setComicBubble(null), 4000);
  };

  const openSession = (session) => {
    if (isLoading) return;
    if (session.id !== activeId) {
      resetRobot();
      setActiveId(session.id);
      setMessages(session.messages);
    }
    setIsHistoryOpen(false);
    setIsLogOpen(true);
  };

  // Fungsi Kirim Pesan via Vercel Serverless Function (/api/chat)
  const handleSendMessage = async (e, customText = null) => {
    if (e) e.preventDefault();
    const query = (customText !== null ? customText : chatInput).trim();
    if (!query || isLoading) return;

    setMessages((prev) => [...prev, { sender: 'user', text: query }]);
    if (customText === null) setChatInput('');
    setIsLoading(true);

    clearTimeout(talkTimerRef.current);
    clearTimeout(bubbleTimerRef.current);
    playAnimation('idle');
    setComicBubble('Hmm, kupikirkan dulu ya...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: query }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan pada server');
      }

      const reply = data.reply || 'Hmm, aku belum punya jawaban untuk itu.';
      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);

      const polos = reply
        .replace(/```[\s\S]*?(```|$)/g, ' ')
        .replace(/`([^`\n]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .trim();
      speak(polos || 'Ini jawabannya!');
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = 'Maaf, terjadi gangguan pada sistem sirkuit server.';
      setMessages((prev) => [...prev, { sender: 'bot', text: errorMsg }]);
      speak(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-sky-100 text-slate-800 font-sans select-none antialiased">
      <header className="h-16 px-6 z-30 flex items-center border-b border-workshop-200/80 bg-white/80 backdrop-blur-md shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 to-workshop-300 flex items-center justify-center text-white shadow-md shadow-sky-200 border border-white">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg text-slate-800 tracking-tight">
              RoboCraft<span className="text-sky-500"> Studio</span>
            </span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-workshop-100 text-workshop-600 border border-workshop-200">
              v3.2 GLB
            </span>
          </div>
        </div>
      </header>

      <main className="relative flex-1 w-full h-[calc(100vh-4rem)] overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img alt="Workshop Garage Background" className="w-full h-full object-cover object-center" src="/garasi.JPEG" />
          <div className="absolute inset-0 bg-sky-900/10 backdrop-contrast-[1.02] pointer-events-none"></div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-10" ref={mountRef}></div>

        <button
          onClick={() => setIsHistoryOpen(true)}
          aria-label="Buka riwayat percakapan"
          title="Riwayat percakapan"
          className={`absolute top-4 left-4 z-30 w-10 h-10 rounded-full bg-white/90 backdrop-blur border border-workshop-200 hover:border-sky-400 flex items-center justify-center text-slate-600 hover:text-sky-600 shadow-md transition ${focusRing}`}
        >
          <History className="w-4 h-4" />
        </button>

        {comicBubble && (
          <div className="absolute top-[18%] left-[57%] max-w-[min(220px,38%)] bg-white text-slate-800 p-4 rounded-3xl rounded-bl-none shadow-2xl border-2 border-sky-200 z-20">
            <p className="text-sm font-bold leading-relaxed line-clamp-5">{comicBubble}</p>
            <div className="absolute -bottom-2 left-0 w-4 h-4 bg-white border-b-2 border-l-2 border-sky-200 transform -translate-x-1 rotate-[-45deg] z-[-1]"></div>
          </div>
        )}

        {isHistoryOpen && <div className="absolute inset-0 z-40 bg-slate-900/20" onClick={() => setIsHistoryOpen(false)} aria-hidden="true" />}

        <aside
          aria-label="Riwayat percakapan"
          aria-hidden={!isHistoryOpen}
          className={`absolute inset-y-0 left-0 z-50 w-80 max-w-[85%] flex flex-col bg-white/95 backdrop-blur-xl border-r border-workshop-200 shadow-2xl transition-[transform,visibility] duration-300 ${isHistoryOpen ? 'translate-x-0 visible' : '-translate-x-full invisible'
            }`}
        >
          <div className="p-5 pb-3 flex items-center justify-between shrink-0">
            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-sky-500" /> Riwayat percakapan
            </h2>
            <button onClick={() => setIsHistoryOpen(false)} aria-label="Tutup riwayat" className={`p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition ${focusRing}`}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 pb-3 shrink-0">
            <button
              onClick={startNewChat}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-bold py-2.5 shadow-sm transition ${focusRing}`}
            >
              <Plus className="w-4 h-4" /> Percakapan baru
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-400 leading-relaxed mt-2">Belum ada riwayat.</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => openSession(s)}
                      disabled={isLoading}
                      className={`w-full text-left p-3 rounded-xl border transition disabled:opacity-60 ${focusRing} ${s.id === activeId ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-100 hover:border-sky-200'
                        }`}
                    >
                      <div className="text-xs text-slate-400 mb-0.5">{formatTanggal(s.updatedAt)}</div>
                      <div className="text-sm font-medium text-slate-700 truncate">{s.title}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {isLogOpen && (
          <section
            aria-label="Log chat dengan Sparky"
            className="absolute z-30 bottom-32 right-4 w-[360px] max-w-[calc(100%-2rem)] h-[calc(100%-8rem)] max-h-[500px] flex flex-col rounded-3xl bg-white/90 backdrop-blur-xl border-2 border-workshop-200 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-workshop-200/60 bg-white/70 shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-workshop-300 flex items-center justify-center text-white shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 leading-tight">Log chat</div>
                <div className="text-xs text-slate-500 leading-tight">{isLoading ? 'Sparky sedang mengetik...' : 'Percakapan dengan Sparky'}</div>
              </div>
              <button
                onClick={handleClearChat}
                disabled={isLoading || messages.length <= 1}
                aria-label="Hapus percakapan ini"
                title="Hapus percakapan ini"
                className={`flex items-center gap-1 p-1.5 rounded-full transition disabled:opacity-40 ${focusRing} ${confirmClear ? 'bg-red-50 text-red-600 hover:bg-red-100 px-2.5' : 'text-slate-500 hover:bg-slate-100'
                  }`}
              >
                <Trash2 className="w-4 h-4" />
                {confirmClear && <span className="text-xs font-bold">Hapus?</span>}
              </button>
              <button onClick={() => setIsLogOpen(false)} aria-label="Tutup log chat" className={`p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition ${focusRing}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={listRef} role="log" aria-live="polite" className="flex-1 overflow-y-auto px-3 py-3 space-y-2 select-text">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`min-w-0 px-3.5 py-2 text-sm leading-relaxed break-words shadow-sm ${m.sender === 'user'
                        ? 'max-w-[85%] whitespace-pre-wrap bg-sky-500 text-white rounded-2xl rounded-br-md'
                        : 'max-w-[94%] bg-slate-100 text-slate-800 rounded-2xl rounded-bl-md'
                      }`}
                  >
                    {m.sender === 'user' ? (
                      m.text
                    ) : (
                      <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {m.text}
                      </Markdown>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Kontainer Bawah: Quick Prompt Chips + Form Input */}
        <div className="absolute z-30 bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl flex flex-col gap-2">

          {/* ✨ TOMBOL SARAN PERTANYAAN CEPAT (QUICK PROMPT CHIPS) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1 scrollbar-none">
            {[
              "Cara kerja ESP32",
              "Troubleshooting Sensor",
              "Bahasa Pemrograman IoT"
            ].map((chipText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(null, chipText)}
                disabled={isLoading}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white/80 hover:bg-sky-500 hover:text-white border border-workshop-200 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition disabled:opacity-50"
              >
                {chipText}
              </button>
            ))}
          </div>

          {/* Form Input Chat */}
          <form
            onSubmit={(e) => handleSendMessage(e)}
            className="flex items-center gap-2 rounded-full border-2 border-workshop-200 bg-white/90 backdrop-blur-xl shadow-2xl px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => setIsLogOpen((v) => !v)}
              aria-label={isLogOpen ? 'Tutup log chat' : 'Lihat log chat'}
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition ${focusRing} ${isLogOpen ? 'bg-sky-100 text-sky-600' : 'text-slate-500 hover:bg-slate-100'
                }`}
            >
              <MessageCircle className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isLoading ? 'Menunggu jawaban Sparky...' : 'Tanya seputar teknologi...'}
              className="flex-1 min-w-0 text-base sm:text-sm rounded-full border border-workshop-200/80 bg-white px-4 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 transition shadow-inner select-text"
            />

            <button
              type="submit"
              disabled={isLoading || !chatInput.trim()}
              aria-label="Kirim pesan"
              className={`w-9 h-9 rounded-full text-white flex items-center justify-center shrink-0 shadow-md transition active:scale-95 disabled:bg-slate-300 bg-sky-500 hover:bg-sky-600 ${focusRing}`}
            >
              <Send className="w-4 h-4 translate-x-0.5" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}