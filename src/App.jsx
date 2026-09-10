import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Dumbbell, 
  Timer, 
  Calendar as CalendarIcon, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Plus, 
  Minus, 
  Flame, 
  Trophy, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Activity, 
  Clock, 
  Check, 
  Trash2,
  TrendingUp,
  Wind,
  Sun,
  Moon,
  AlertCircle,
  ShieldCheck,
  Film
} from 'lucide-react';

// Synthesizes high-clarity sound prompts without external audio dependencies
const playSynthesizedTone = (frequency = 600, duration = 0.15, type = 'sine', volume = 0.2) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error("Web Audio playback error:", e);
  }
};

// 1x1 像素超輕量 Base64 MP4 靜音視訊資料，用於規避行動裝置省電休眠
const SILENT_VIDEO_BASE64 = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAsbWRhdAAEAAD//wAAAUhtbzB2AAAAeG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAABanRyYWsAAAAAc3RoZAAAAAABAAAAAAAA';

const TEMPO_PRESETS = [
  { name: '肌肥大增肌 (3-1-1-0)', label: '3-1-1-0', tempo: [3, 1, 1, 0], desc: '3秒慢放，1秒底停，1秒爆發發力' },
  { name: '標準勻速 (2-0-2-0)', label: '2-0-2-0', tempo: [2, 0, 2, 0], desc: '控制平穩，肌群持續張力' },
  { name: '離心專注 (4-1-2-0)', label: '4-1-2-0', tempo: [4, 1, 2, 0], desc: '4秒極慢下放，極限肌肉撕裂度' },
  { name: '爆發啟動 (2-1-X-0)', label: '2-1-1-0', tempo: [2, 1, 1, 0], desc: '2秒下沉，向心最大速度上推' },
];

const POPULAR_EXERCISES = ['槓鈴深蹲', '平板臥推', '傳統硬舉', '引體向上', '啞鈴肩推', '槓鈴划船', '保加利亞分腿蹲', '雙槓臂屈伸'];

const REST_PRESETS = [30, 60, 90, 120, 180];

const INITIAL_LOGS = {
  '2026-09-02': [
    { id: '1', name: '平板臥推', sets: 4, reps: 8, weight: 80, completed: true, totalVolume: 2560 },
    { id: '2', name: '槓鈴划船', sets: 4, reps: 10, weight: 65, completed: true, totalVolume: 2600 },
  ],
  '2026-09-05': [
    { id: '3', name: '槓鈴深蹲', sets: 5, reps: 5, weight: 110, completed: true, totalVolume: 2750 },
    { id: '4', name: '保加利亞分腿蹲', sets: 3, reps: 10, weight: 20, completed: true, totalVolume: 600 },
  ],
  '2026-09-08': [
    { id: '5', name: '傳統硬舉', sets: 4, reps: 6, weight: 130, completed: true, totalVolume: 3120 },
    { id: '6', name: '啞鈴肩推', sets: 4, reps: 10, weight: 24, completed: true, totalVolume: 960 },
  ],
};

export default function App() {
  const [activeTab, setActiveTab] = useState('tracker'); // 'tracker' | 'rest' | 'calendar'
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Screen Wake Lock & Video Loop Dual-Mode State
  // mode: 'none' | 'native' | 'video_fallback'
  const [wakeLockMode, setWakeLockMode] = useState('none');
  const [showPowerOptimizationTip, setShowPowerOptimizationTip] = useState(false);
  const wakeLockSentinelRef = useRef(null);
  const fallbackVideoRef = useRef(null);

  // Exercise & Set Counter State
  const [exerciseName, setExerciseName] = useState('槓鈴深蹲');
  const [weight, setWeight] = useState(80);
  const [targetReps, setTargetReps] = useState(10);
  const [targetSets, setTargetSets] = useState(4);
  const [setsData, setSetsData] = useState([
    { id: 1, completed: false, reps: 10, weight: 80 },
    { id: 2, completed: false, reps: 10, weight: 80 },
    { id: 3, completed: false, reps: 10, weight: 80 },
    { id: 4, completed: false, reps: 10, weight: 80 },
  ]);

  // Tempo & Breathing Metronome State
  const [isTempoActive, setIsTempoActive] = useState(false);
  const [tempoValues, setTempoValues] = useState([3, 1, 1, 0]); // [Eccentric, PauseBottom, Concentric, PauseTop]
  const [currentTempoPhaseIdx, setCurrentTempoPhaseIdx] = useState(0);
  const [tempoPhaseSecondsLeft, setTempoPhaseSecondsLeft] = useState(3);
  const [metronomeRepsDone, setMetronomeRepsDone] = useState(0);
  const tempoIntervalRef = useRef(null);

  // Rest Timer State
  const [restDuration, setRestDuration] = useState(60);
  const [restSecondsLeft, setRestSecondsLeft] = useState(60);
  const [isRestActive, setIsRestActive] = useState(false);
  const restIntervalRef = useRef(null);

  // Calendar and Log State
  const [workoutLogs, setWorkoutLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('gym_workout_logs');
      return saved ? JSON.parse(saved) : INITIAL_LOGS;
    } catch {
      return INITIAL_LOGS;
    }
  });

  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date(2026, 8, 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('2026-09-10');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // 啟動隱形微型循環影片（Video Loop Fallback - 方法二）
  const startVideoLoopFallback = useCallback(async () => {
    if (!fallbackVideoRef.current) return false;
    try {
      const video = fallbackVideoRef.current;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      
      // 如果影片無 source 則動態生成 canvas 串流備援
      if (!video.src) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 8;
          canvas.height = 8;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 8, 8);
          }
          if (canvas.captureStream) {
            video.srcObject = canvas.captureStream(1);
          } else {
            video.src = SILENT_VIDEO_BASE64;
          }
        } catch {
          video.src = SILENT_VIDEO_BASE64;
        }
      }

      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      setWakeLockMode('video_fallback');
      return true;
    } catch (err) {
      console.warn('Video fallback failed:', err);
      return false;
    }
  }, []);

  // 停止隱形影片播放
  const stopVideoLoopFallback = useCallback(() => {
    if (fallbackVideoRef.current) {
      try {
        fallbackVideoRef.current.pause();
        if (fallbackVideoRef.current.srcObject) {
          fallbackVideoRef.current.srcObject = null;
        }
      } catch (err) {
        console.warn('Stop video fallback error:', err);
      }
    }
  }, []);

  // 請求原生螢幕常亮鎖定，若遭電池限制失敗則自動降級為方法二
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinelRef.current = sentinel;
        setWakeLockMode('native');

        sentinel.addEventListener('release', () => {
          wakeLockSentinelRef.current = null;
          // 若非手動關閉，自動切換至備援模式
          setWakeLockMode(prev => (prev === 'native' ? 'none' : prev));
        });
        return 'native';
      } catch (err) {
        console.warn('原生 Wake Lock 受限（可能因省電模式或電池最佳化）：', err);
        // 原生失敗，自動降級為方法二 (微型靜音影片播放)
        const fallbackSuccess = await startVideoLoopFallback();
        return fallbackSuccess ? 'video_fallback' : 'failed';
      }
    } else {
      // 瀏覽器不支援原生 API，直接採用方法二
      const fallbackSuccess = await startVideoLoopFallback();
      return fallbackSuccess ? 'video_fallback' : 'failed';
    }
  }, [startVideoLoopFallback]);

  // 關閉所有常亮模式
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockSentinelRef.current) {
      try {
        await wakeLockSentinelRef.current.release();
      } catch (err) {
        console.error('Wake Lock release error:', err);
      }
      wakeLockSentinelRef.current = null;
    }
    stopVideoLoopFallback();
    setWakeLockMode('none');
  }, [stopVideoLoopFallback]);

  // 切換螢幕常亮開關
  const toggleWakeLock = async () => {
    if (wakeLockMode !== 'none') {
      await releaseWakeLock();
      showToast('💤 已切換回系統預設休眠');
    } else {
      const mode = await requestWakeLock();
      if (mode === 'native') {
        showToast('☀️ 螢幕常亮已開啟（原生鎖定中）');
      } else if (mode === 'video_fallback') {
        showToast('🛡️ 已啟動防休眠視訊備援（突破省電與電池最佳化限制）');
      } else {
        showToast('⚠️ 無法鎖定螢幕，請點擊提示圖示調整電池權限');
      }
    }
  };

  // 處理切換分頁 (visibilitychange) 後的重新取得與續播
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockMode !== 'none') {
        if (wakeLockMode === 'native' && !wakeLockSentinelRef.current) {
          await requestWakeLock();
        } else if (wakeLockMode === 'video_fallback' && fallbackVideoRef.current?.paused) {
          await startVideoLoopFallback();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current.release().catch(() => {});
      }
      stopVideoLoopFallback();
    };
  }, [wakeLockMode, requestWakeLock, startVideoLoopFallback, stopVideoLoopFallback]);

  useEffect(() => {
    try {
      localStorage.setItem('gym_workout_logs', JSON.stringify(workoutLogs));
    } catch (e) {
      console.warn("Storage write failed", e);
    }
  }, [workoutLogs]);

  const updateTargetSets = (newTotal) => {
    const valid = Math.max(1, Math.min(12, newTotal));
    setTargetSets(valid);
    setSetsData(prev => {
      if (prev.length < valid) {
        const added = [];
        for (let i = prev.length + 1; i <= valid; i++) {
          added.push({ id: i, completed: false, reps: targetReps, weight: weight });
        }
        return [...prev, ...added];
      } else {
        return prev.slice(0, valid);
      }
    });
  };

  const TEMPO_PHASE_NAMES = [
    { name: '離心下放 (吸氣 Inhale)', short: '下放吸氣', color: 'from-blue-500 to-cyan-400', textColor: 'text-cyan-300', freq: 440, soundType: 'sine' },
    { name: '底部停頓 (穩定 Hold)', short: '底部停頓', color: 'from-amber-500 to-yellow-400', textColor: 'text-yellow-300', freq: 520, soundType: 'triangle' },
    { name: '向心發力 (吐氣 Exhale)', short: '發力吐氣', color: 'from-emerald-500 to-teal-400', textColor: 'text-emerald-300', freq: 660, soundType: 'sine' },
    { name: '頂點收縮 (頂部 Reset)', short: '頂點收縮', color: 'from-purple-500 to-pink-500', textColor: 'text-purple-300', freq: 880, soundType: 'square' },
  ];

  const getNextValidPhase = (currIdx, tempoArr) => {
    let nextIdx = (currIdx + 1) % 4;
    let loopCount = 0;
    while (tempoArr[nextIdx] === 0 && loopCount < 4) {
      nextIdx = (nextIdx + 1) % 4;
      loopCount++;
    }
    return nextIdx;
  };

  useEffect(() => {
    if (!isTempoActive) {
      if (tempoIntervalRef.current) clearInterval(tempoIntervalRef.current);
      return;
    }

    tempoIntervalRef.current = setInterval(() => {
      setTempoPhaseSecondsLeft((prevSec) => {
        if (prevSec > 1) {
          if (soundEnabled) playSynthesizedTone(380, 0.06, 'sine', 0.1);
          return prevSec - 1;
        }

        let nextPhase = getNextValidPhase(currentTempoPhaseIdx, tempoValues);
        let finishedOneRep = nextPhase <= currentTempoPhaseIdx;

        if (finishedOneRep) {
          setMetronomeRepsDone(r => r + 1);
          if (soundEnabled) playSynthesizedTone(880, 0.25, 'triangle', 0.3);
        } else {
          if (soundEnabled) playSynthesizedTone(TEMPO_PHASE_NAMES[nextPhase].freq, 0.15, 'sine', 0.25);
        }

        setCurrentTempoPhaseIdx(nextPhase);
        return tempoValues[nextPhase];
      });
    }, 1000);

    return () => clearInterval(tempoIntervalRef.current);
  }, [isTempoActive, currentTempoPhaseIdx, tempoValues, soundEnabled]);

  const toggleTempoPlay = () => {
    if (!isTempoActive) {
      let initPhase = 0;
      if (tempoValues[0] === 0) {
        initPhase = getNextValidPhase(0, tempoValues);
      }
      setCurrentTempoPhaseIdx(initPhase);
      setTempoPhaseSecondsLeft(tempoValues[initPhase]);
      if (soundEnabled) playSynthesizedTone(587, 0.2, 'sine', 0.25);
    }
    setIsTempoActive(!isTempoActive);
  };

  const resetTempo = () => {
    setIsTempoActive(false);
    let initPhase = tempoValues[0] > 0 ? 0 : getNextValidPhase(0, tempoValues);
    setCurrentTempoPhaseIdx(initPhase);
    setTempoPhaseSecondsLeft(tempoValues[initPhase]);
    setMetronomeRepsDone(0);
  };

  useEffect(() => {
    if (!isRestActive) {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      return;
    }

    restIntervalRef.current = setInterval(() => {
      setRestSecondsLeft((sec) => {
        if (sec <= 1) {
          setIsRestActive(false);
          if (soundEnabled) {
            playSynthesizedTone(784, 0.18, 'sine', 0.35);
            setTimeout(() => playSynthesizedTone(784, 0.18, 'sine', 0.35), 220);
            setTimeout(() => playSynthesizedTone(1046, 0.4, 'sine', 0.4), 440);
          }
          showToast('🔔 休息結束！準備下一組！');
          return 0;
        }
        if (sec <= 4 && soundEnabled) {
          playSynthesizedTone(440, 0.08, 'sine', 0.15);
        }
        return sec - 1;
      });
    }, 1000);

    return () => clearInterval(restIntervalRef.current);
  }, [isRestActive, soundEnabled]);

  const startRestTimer = (seconds) => {
    const dur = seconds !== undefined ? seconds : restDuration;
    setRestDuration(dur);
    setRestSecondsLeft(dur);
    setIsRestActive(true);
    if (soundEnabled) playSynthesizedTone(659, 0.15, 'sine', 0.2);
  };

  const handleToggleSet = (index) => {
    const updated = [...setsData];
    updated[index].completed = !updated[index].completed;
    setSetsData(updated);

    if (updated[index].completed) {
      if (soundEnabled) playSynthesizedTone(659, 0.12, 'sine', 0.25);
    }
  };

  const handleCompleteCurrentAndRest = () => {
    const firstUnfinishedIdx = setsData.findIndex(s => !s.completed);
    if (firstUnfinishedIdx !== -1) {
      const updated = [...setsData];
      updated[firstUnfinishedIdx].completed = true;
      setSetsData(updated);

      startRestTimer(restDuration);
      showToast(`第 ${firstUnfinishedIdx + 1} 組完成！開始休息 ${restDuration} 秒 ⏱️`);
      setActiveTab('rest');
    } else {
      startRestTimer(restDuration);
      setActiveTab('rest');
      showToast('所有組數已打勾！繼續進行休息計時');
    }
  };

  const handleSaveWorkoutToCalendar = () => {
    const completedCount = setsData.filter(s => s.completed).length;
    if (completedCount === 0) {
      showToast('請先至少打勾完成一組訓練！');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const totalVolume = setsData
      .filter(s => s.completed)
      .reduce((acc, curr) => acc + (curr.weight * curr.reps), 0);

    const newEntry = {
      id: Date.now().toString(),
      name: exerciseName,
      sets: completedCount,
      reps: targetReps,
      weight: weight,
      completed: true,
      totalVolume: totalVolume
    };

    setWorkoutLogs(prev => {
      const dayLogs = prev[todayStr] ? [...prev[todayStr]] : [];
      return {
        ...prev,
        [todayStr]: [...dayLogs, newEntry]
      };
    });

    setSelectedCalendarDate(todayStr);
    showToast(`✅ 已將「${exerciseName}」紀錄至今日行事曆！`);
  };

  const calendarMetrics = useMemo(() => {
    const currentYear = currentCalendarMonth.getFullYear();
    const currentMonth = currentCalendarMonth.getMonth();

    let totalMonthSessions = 0;
    let totalMonthSets = 0;
    let totalMonthVolume = 0;

    Object.entries(workoutLogs).forEach(([dateStr, items]) => {
      const [y, m] = dateStr.split('-').map(Number);
      if (y === currentYear && m === (currentMonth + 1)) {
        totalMonthSessions += 1;
        items.forEach(item => {
          totalMonthSets += item.sets || 0;
          totalMonthVolume += item.totalVolume || 0;
        });
      }
    });

    return { totalMonthSessions, totalMonthSets, totalMonthVolume };
  }, [workoutLogs, currentCalendarMonth]);

  const renderCalendarDays = () => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-full opacity-0" />);
    }

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const formattedDay = day < 10 ? `0${day}` : `${day}`;
      const formattedMonth = (month + 1) < 10 ? `0${month + 1}` : `${month + 1}`;
      const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

      const hasWorkout = Boolean(workoutLogs[dateStr] && workoutLogs[dateStr].length > 0);
      const isSelected = selectedCalendarDate === dateStr;
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push(
        <button
          key={dateStr}
          onClick={() => setSelectedCalendarDate(dateStr)}
          className={`relative h-12 w-full rounded-xl flex flex-col items-center justify-center font-medium text-sm transition-all duration-200 border ${
            isSelected 
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-105 z-10'
              : hasWorkout
              ? 'bg-slate-800/80 border-slate-700 hover:border-emerald-500/50 text-slate-100'
              : 'bg-slate-900/40 border-transparent hover:bg-slate-800/50 text-slate-400'
          }`}
        >
          <span>{day}</span>
          {hasWorkout && (
            <span className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {workoutLogs[dateStr].length > 1 && (
                <span className="text-[10px] text-emerald-400 font-bold">+{workoutLogs[dateStr].length}</span>
              )}
            </span>
          )}
          {isToday && (
            <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" title="今日" />
          )}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* 隱形微型靜音視訊元素（方法二：Video Loop 防休眠核心） */}
      <video
        ref={fallbackVideoRef}
        muted
        loop
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        className="fixed -top-10 -left-10 w-1 h-1 opacity-[0.01] pointer-events-none z-[-1]"
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/85 border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Dumbbell className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl tracking-wide bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                FITSYNC 智能重訓輔助
              </h1>
              <p className="text-xs text-slate-400">次數節拍・休息計時・訓練紀錄</p>
            </div>
          </div>

          {/* Quick Header Toggles: Wake Lock & Sound */}
          <div className="flex items-center gap-2">
            {/* Screen Wake Lock Button (支援原生與視訊備援雙模式) */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleWakeLock}
                title={
                  wakeLockMode === 'native'
                    ? '常亮中（原生鎖定，點擊切換為休眠）'
                    : wakeLockMode === 'video_fallback'
                    ? '常亮中（視訊備援防護，繞過省電模式限制）'
                    : '點擊開啟螢幕常亮（訓練不暗屏）'
                }
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  wakeLockMode === 'native'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : wakeLockMode === 'video_fallback'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {wakeLockMode === 'native' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400 fill-amber-400/30 animate-pulse" />
                    <span className="inline">常亮中</span>
                  </>
                ) : wakeLockMode === 'video_fallback' ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span className="inline">常亮(備援)</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-400" />
                    <span className="hidden sm:inline">可休眠</span>
                  </>
                )}
              </button>

              {/* 說明按鈕 */}
              <button
                onClick={() => setShowPowerOptimizationTip(!showPowerOptimizationTip)}
                className="p-1.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="電池限制與常亮說明"
              >
                <AlertCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Audio Toggle Button */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? '點擊靜音' : '點擊開啟節奏提示音'}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium ${
                soundEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? '音效開' : '靜音'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Screen Wake Lock Informational Banner */}
      {wakeLockMode !== 'none' && (
        <div className={`border-b px-4 py-1.5 text-[11px] flex items-center justify-center gap-2 text-center transition-colors ${
          wakeLockMode === 'native'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-300/90'
            : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300/90'
        }`}>
          {wakeLockMode === 'native' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>原生防休眠鎖定中，訓練與計時過程中不會黑屏</span>
            </>
          ) : (
            <>
              <Film className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>已啟用微型視訊防護（方法二）：已繞過省電模式與電池最佳化限制，保持螢幕常亮</span>
            </>
          )}
        </div>
      )}

      {/* 電池設定教學彈窗 */}
      {showPowerOptimizationTip && (
        <div className="bg-slate-900 border-b border-slate-700/80 px-4 py-3 text-xs text-slate-300">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <p className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                常亮雙重防護機制說明
              </p>
              <p className="text-slate-400 leading-relaxed">
                本系統優先使用瀏覽器原生 Wake Lock；若手機開啟「省電模式」或瀏覽器被列入「電池最佳化」，將會自動啟動<strong>方法二（背景微型靜音視訊循環）</strong>，使 iOS 與 Android 系統判定處於播放狀態而不暗屏。若仍發生自動熄屏，請將手機「省電模式」關閉或把瀏覽器電池權限改為「不受限制」。
              </p>
            </div>
            <button
              onClick={() => setShowPowerOptimizationTip(false)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg shrink-0 border border-slate-700 mt-2 sm:mt-0"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* Toast floating banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl mb-6 shadow-inner">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 ${
              activeTab === 'tracker'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>訓練與節奏</span>
          </button>
          <button
            onClick={() => setActiveTab('rest')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 relative ${
              activeTab === 'rest'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>組間休息</span>
            {isRestActive && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 ${
              activeTab === 'calendar'
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold shadow-md shadow-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>訓練行事曆</span>
          </button>
        </div>

        {/* ================= TAB 1: 訓練計數器 & 呼吸節拍器 ================= */}
        {activeTab === 'tracker' && (
          <div className="space-y-6">
            {/* Top Quick Info Card */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-sm relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/70">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />
                    選擇或輸入動作名稱
                  </label>
                  <input
                    type="text"
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-white font-bold text-lg focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="例如：槓鈴深蹲、引體向上"
                  />
                </div>
                {/* Popular Tags */}
                <div className="sm:max-w-xs">
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">熱門推薦動作</label>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_EXERCISES.slice(0, 4).map(item => (
                      <button
                        key={item}
                        onClick={() => setExerciseName(item)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg transition-all border ${
                          exerciseName === item
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                            : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weight & Target Reps Adjustments */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
                {/* Weight Setting */}
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 font-medium">負重 (kg)</span>
                  <div className="flex items-center justify-between mt-1">
                    <button 
                      onClick={() => setWeight(w => Math.max(0, w - 2.5))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl sm:text-2xl font-black text-slate-100">{weight}</span>
                    <button 
                      onClick={() => setWeight(w => w + 2.5)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Target Reps Setting */}
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 font-medium">每組目標次數</span>
                  <div className="flex items-center justify-between mt-1">
                    <button 
                      onClick={() => setTargetReps(r => Math.max(1, r - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl sm:text-2xl font-black text-slate-100">{targetReps}</span>
                    <button 
                      onClick={() => setTargetReps(r => r + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Target Sets Setting */}
                <div className="col-span-2 sm:col-span-1 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <span className="text-xs text-slate-400 font-medium">總規劃組數</span>
                  <div className="flex items-center justify-between mt-1">
                    <button 
                      onClick={() => updateTargetSets(targetSets - 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl sm:text-2xl font-black text-emerald-400">{targetSets}</span>
                    <button 
                      onClick={() => updateTargetSets(targetSets + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Set Tracker Rows */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base text-slate-100">組數完成進度</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/20">
                    {setsData.filter(s => s.completed).length} / {setsData.length} 完成
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSetsData(prev => prev.map(s => ({ ...s, completed: false })));
                    showToast('已重設所有組數狀態');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 全部重設
                </button>
              </div>

              <div className="space-y-2.5">
                {setsData.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleSet(idx)}
                    className={`cursor-pointer flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 select-none ${
                      item.completed
                        ? 'bg-emerald-950/30 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                        item.completed
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {item.completed ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-sm sm:text-base text-slate-200">
                          第 {idx + 1} 組
                        </div>
                        <div className="text-xs text-slate-400">
                          {weight} kg × {targetReps} 次
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        item.completed
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.completed ? '已完成' : '點擊標記'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action: Complete Set and Start Rest */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleCompleteCurrentAndRest}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  完成當前組並開始休息 ({restDuration}s)
                </button>

                <button
                  onClick={handleSaveWorkoutToCalendar}
                  className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-2xl border border-slate-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <CalendarIcon className="w-4 h-4 text-purple-400" />
                  儲存此項目至今日紀錄
                </button>
              </div>
            </div>

            {/* Tempo & Breathing Metronome Section */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wind className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-base text-slate-100">肌肉張力 (TUT) 呼吸節奏節拍器</h3>
                </div>
                <div className="text-xs bg-slate-800/80 px-2.5 py-1 rounded-full text-slate-300 font-mono">
                  已完成節奏次數: <span className="text-cyan-300 font-bold text-sm">{metronomeRepsDone}</span> 次
                </div>
              </div>

              {/* Tempo Presets Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                {TEMPO_PRESETS.map((p) => {
                  const isCurrent = JSON.stringify(tempoValues) === JSON.stringify(p.tempo);
                  return (
                    <button
                      key={p.label}
                      onClick={() => {
                        setTempoValues(p.tempo);
                        if (isTempoActive) resetTempo();
                        showToast(`已切換為：${p.name}`);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-xs">{p.label}</div>
                      <div className="text-[11px] truncate opacity-80">{p.name.split(' ')[0]}</div>
                    </button>
                  );
                })}
              </div>

              {/* Animated Interactive Breathing Circle */}
              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center">
                  <div
                    className={`absolute inset-0 rounded-full transition-all duration-1000 ${
                      isTempoActive
                        ? currentTempoPhaseIdx === 0
                          ? 'bg-gradient-to-tr from-blue-600/30 to-cyan-500/30 scale-110 blur-xl animate-pulse'
                          : currentTempoPhaseIdx === 2
                          ? 'bg-gradient-to-tr from-emerald-600/30 to-teal-500/30 scale-90 blur-xl'
                          : 'bg-gradient-to-tr from-amber-600/20 to-yellow-500/20 scale-100 blur-lg'
                        : 'bg-slate-800/30 scale-90 blur-md'
                    }`}
                  />

                  <div
                    className={`relative w-44 h-44 sm:w-48 sm:h-48 rounded-full flex flex-col items-center justify-center border-4 shadow-2xl transition-all duration-700 ${
                      isTempoActive
                        ? `${TEMPO_PHASE_NAMES[currentTempoPhaseIdx].textColor} border-current bg-slate-950`
                        : 'border-slate-700 text-slate-400 bg-slate-950'
                    } ${
                      isTempoActive && currentTempoPhaseIdx === 0 ? 'scale-110' : ''
                    } ${
                      isTempoActive && currentTempoPhaseIdx === 2 ? 'scale-95' : ''
                    }`}
                  >
                    <span className="text-xs uppercase tracking-widest font-bold opacity-75">
                      {isTempoActive ? TEMPO_PHASE_NAMES[currentTempoPhaseIdx].short : '準備就緒'}
                    </span>
                    <span className="text-5xl sm:text-6xl font-black font-mono my-1 tracking-tight">
                      {isTempoActive ? tempoPhaseSecondsLeft : tempoValues[0]}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 px-3 text-center">
                      {isTempoActive ? TEMPO_PHASE_NAMES[currentTempoPhaseIdx].name : '按下開始維持張力'}
                    </span>
                  </div>
                </div>

                {/* 4 Phases Indicators */}
                <div className="grid grid-cols-4 gap-2 w-full max-w-sm mt-4">
                  {['下放離心', '底部停頓', '向心發力', '頂點復位'].map((title, i) => (
                    <div
                      key={title}
                      className={`text-center p-2 rounded-xl border transition-all ${
                        isTempoActive && currentTempoPhaseIdx === i
                          ? 'bg-slate-800 border-cyan-400 text-cyan-300 font-bold scale-105'
                          : 'bg-slate-950/50 border-slate-800/70 text-slate-500'
                      }`}
                    >
                      <div className="text-[10px]">{title}</div>
                      <div className="text-sm font-mono font-bold mt-0.5">{tempoValues[i]}s</div>
                    </div>
                  ))}
                </div>

                {/* Control Buttons for Metronome */}
                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={toggleTempoPlay}
                    className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                      isTempoActive
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                    }`}
                  >
                    {isTempoActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isTempoActive ? '暫停節拍' : '開始節奏節拍'}</span>
                  </button>

                  <button
                    onClick={resetTempo}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition-all"
                    title="重新計次與秒數"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: 組間休息計時器 ================= */}
        {activeTab === 'rest' && (
          <div className="space-y-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="text-center mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-2">
                  <Clock className="w-3.5 h-3.5" /> 肌肉糖原恢復・神經系統重置
                </span>
                <h2 className="text-2xl font-bold text-slate-100">組間休息計時器</h2>
                <p className="text-xs text-slate-400 mt-1">
                  肌力訓練建議 2~3 分鐘，肌肥大訓練建議 60~90 秒
                </p>
              </div>

              {/* Large Radial Countdown Ring */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center my-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="stroke-slate-800 fill-none"
                    strokeWidth="6"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="stroke-cyan-400 fill-none transition-all duration-1000 ease-linear"
                    strokeWidth="6"
                    strokeDasharray={264}
                    strokeDashoffset={264 - (264 * (restSecondsLeft / Math.max(1, restDuration)))}
                    strokeLinecap="round"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-white">
                    {Math.floor(restSecondsLeft / 60)}:{(restSecondsLeft % 60).toString().padStart(2, '0')}
                  </div>
                  <span className={`text-xs font-semibold mt-2 px-2.5 py-0.5 rounded-full ${
                    isRestActive ? 'bg-cyan-500/20 text-cyan-300 animate-pulse' : restSecondsLeft === 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isRestActive ? '休息倒數中...' : restSecondsLeft === 0 ? '休息結束！' : '計時已暫停'}
                  </span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-md">
                {REST_PRESETS.map((seconds) => (
                  <button
                    key={seconds}
                    onClick={() => startRestTimer(seconds)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      restDuration === seconds && isRestActive
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/25 scale-105'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {seconds >= 60 ? `${seconds / 60} 分鐘` : `${seconds} 秒`}
                  </button>
                ))}
              </div>

              {/* Main Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    if (restSecondsLeft === 0) setRestSecondsLeft(restDuration);
                    setIsRestActive(!isRestActive);
                  }}
                  className={`px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                    isRestActive
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/25'
                  }`}
                >
                  {isRestActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                  <span>{isRestActive ? '暫停休息' : restSecondsLeft === 0 ? '重新計時' : '開始計時'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsRestActive(false);
                    setRestSecondsLeft(restDuration);
                  }}
                  className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition-all"
                  title="重設目前秒數"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                
                <button
                  onClick={() => setRestSecondsLeft(s => s + 15)}
                  className="px-3.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 active:scale-95 transition-all"
                  title="多加15秒"
                >
                  +15 秒
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: 運動日期紀錄行事曆 ================= */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            {/* Monthly Summary Statistics Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>本月天數打卡</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-300">
                  {calendarMetrics.totalMonthSessions} <span className="text-xs font-normal text-slate-400">天</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>累積總組數</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">
                  {calendarMetrics.totalMonthSets} <span className="text-xs font-normal text-slate-400">組</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>本月總容量</span>
                </div>
                <div className="text-lg sm:text-2xl font-black text-cyan-300 truncate">
                  {calendarMetrics.totalMonthVolume >= 1000 
                    ? `${(calendarMetrics.totalMonthVolume / 1000).toFixed(1)}k`
                    : calendarMetrics.totalMonthVolume
                  } <span className="text-xs font-normal text-slate-400">kg</span>
                </div>
              </div>
            </div>

            {/* Interactive Calendar Container */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-base text-slate-100">
                    {currentCalendarMonth.getFullYear()} 年 {currentCalendarMonth.getMonth() + 1} 月
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1));
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1));
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 mb-2">
                <div>日</div>
                <div>一</div>
                <div>二</div>
                <div>三</div>
                <div>四</div>
                <div>五</div>
                <div>六</div>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {renderCalendarDays()}
              </div>
            </div>

            {/* Selected Date Workouts Detail List */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800/70 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <h4 className="font-bold text-sm sm:text-base text-slate-200">
                    {selectedCalendarDate} 訓練日誌
                  </h4>
                </div>
                <span className="text-xs text-slate-400">
                  {workoutLogs[selectedCalendarDate]?.length || 0} 個動作紀錄
                </span>
              </div>

              {workoutLogs[selectedCalendarDate] && workoutLogs[selectedCalendarDate].length > 0 ? (
                <div className="space-y-2.5">
                  {workoutLogs[selectedCalendarDate].map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          <span>{item.name}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            已完成
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {item.weight} kg × {item.sets} 組 × {item.reps} 次 • 總訓練量: {item.totalVolume || (item.weight * item.sets * item.reps)} kg
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const updatedDay = workoutLogs[selectedCalendarDate].filter((_, i) => i !== idx);
                          setWorkoutLogs(prev => ({
                            ...prev,
                            [selectedCalendarDate]: updatedDay
                          }));
                          showToast('已刪除此筆訓練項目');
                        }}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="刪除紀錄"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  當日尚無登記的訓練動作。回到「訓練與節奏」完成一組後點擊儲存即可記錄！
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Persistent Bottom Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate max-w-[140px] sm:max-w-none">動作：<strong className="text-slate-200">{exerciseName}</strong> ({weight}kg)</span>
          </div>

          <div className="flex items-center gap-3">
            <span>進度：<strong className="text-emerald-400">{setsData.filter(s => s.completed).length}/{setsData.length}</strong> 組</span>
            {isRestActive && (
              <span className="text-cyan-300 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                休息中: {restSecondsLeft}s
              </span>
            )}
            {wakeLockMode !== 'none' && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-amber-300">
                {wakeLockMode === 'native' ? (
                  <>
                    <Sun className="w-3 h-3 text-amber-400" />
                    原生常亮
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3 text-cyan-400" />
                    視訊備援常亮
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}