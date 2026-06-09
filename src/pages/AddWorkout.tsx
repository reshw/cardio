import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import workoutService from '../services/workoutService';
import workoutTypeService from '../services/workoutTypeService';
import type { WorkoutType } from '../services/workoutTypeService';
import { uploadToR2 } from '../utils/r2Storage';
import { getDeviceInfo } from '../utils/deviceInfo';
import type { WorkoutCategory, WorkoutSubType, WorkoutUnit, Workout } from '../services/workoutService';
import clubService from '../services/clubService';
import type { MyClubWithOrder } from '../services/clubService';
import DatePickerSheet from '../components/DatePickerSheet';
import { enableFilePickerGuard, disableFilePickerGuard } from '../utils/filePickerGuard';

const KAKAO_SHARE_KEY = 'kakao_share_auto_popup';
const SESSION_KEY = 'addworkout_draft_v2';

type AddWorkoutDraft = {
  step: 1 | 2 | 3 | 4;
  category: WorkoutCategory | null;
  subType: WorkoutSubType;
  subTypeRatio: number;
  value: string;
  workoutDate: string;
  intensity: number;
  memo: string;
  showOtherWorkouts: boolean;
  imagePreview?: string;
};

const DIFF_LEVELS = [
  { emoji: '😌', label: '편안',   min: 1, max: 2,  base: 2  },
  { emoji: '🚶', label: '경쾌',   min: 3, max: 4,  base: 4  },
  { emoji: '🏃', label: '자극',   min: 5, max: 6,  base: 6  },
  { emoji: '🔥', label: '고강도', min: 7, max: 8,  base: 8  },
  { emoji: '💀', label: '한계',   min: 9, max: 10, base: 10 },
];

export const AddWorkout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editWorkout = (location.state as any)?.editWorkout as Workout | undefined;
  const isDebug = new URLSearchParams(window.location.search).get('debug') === '1';
  const DEBUG_LOG_KEY = 'addworkout_debug_log';
  const [debugLogs, setDebugLogs] = useState<{ t: string; msg: string; color: string }[]>(() => {
    if (!isDebug) return [];
    try { return JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || '[]'); } catch { return []; }
  });
  const [showDebug, setShowDebug] = useState(isDebug);
  const addLog = (msg: string, color = '#fff') => {
    if (!isDebug) return;
    const t = new Date().toISOString().slice(11, 23);
    const entry = { t, msg, color };
    setDebugLogs(prev => {
      const next = [...prev.slice(-49), entry];
      try { localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const savedDraft = (() => {
    if (editWorkout) return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Partial<AddWorkoutDraft>) : null;
    } catch {
      return null;
    }
  })();
  const savedDraftRef = useRef(savedDraft);

  const toLocalDatetime = (utcString: string) => {
    const d = new Date(utcString);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  const [step, setStep] = useState<1 | 2 | 3 | 4>((savedDraft?.step as 1 | 2 | 3 | 4 | undefined) ?? (editWorkout ? 3 : 1));
  const [savedWorkout, setSavedWorkout] = useState<Workout | null>(null);
  const [myClubs, setMyClubs] = useState<MyClubWithOrder[]>([]);
  const [shareClubId, setShareClubId] = useState<string>('');
  const [shareNickname, setShareNickname] = useState<string | null>(null);
  const [shareWorkoutNumber, setShareWorkoutNumber] = useState<number | undefined>(undefined);
  const [category, setCategory] = useState<WorkoutCategory | null>(editWorkout?.category ?? (savedDraft?.category ?? null));
  const [subType, setSubType] = useState<WorkoutSubType>(editWorkout?.sub_type ?? (savedDraft?.subType ?? null));
  const [subTypeRatio, setSubTypeRatio] = useState(50); // 0-100, 요가/복싱용 비율 슬라이더
  const [value, setValue] = useState(editWorkout ? editWorkout.value.toString() : (savedDraft?.value ?? ''));
  const [workoutDate, setWorkoutDate] = useState(() => {
    if (editWorkout) return toLocalDatetime(editWorkout.workout_time);
    if (savedDraft?.workoutDate) return savedDraft.workoutDate;
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dateInputRef = useRef<HTMLInputElement>(null);

  const isSamsungBrowser = /SamsungBrowser/i.test(navigator.userAgent);
  const isKakaoInApp = /KAKAOTALK/i.test(navigator.userAgent);
  const isProblematicBrowser = isSamsungBrowser || isKakaoInApp;
  const [showBrowserWarning, setShowBrowserWarning] = useState(
    () => isProblematicBrowser && localStorage.getItem('browser_warning_dismissed') !== '1'
  );
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cursorExp, setCursorExp] = useState(1); // 0=ones, 1=tens, 2=hundreds, -1=tenths
  const cursorExpRef = useRef(1);
  const touchActive = useRef(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [intensity, setIntensity] = useState(editWorkout?.intensity ?? (savedDraft?.intensity ?? 4));
  const [memo, setMemo] = useState(editWorkout?.memo ?? (savedDraft?.memo ?? ''));

  // 동적 운동 종목 로딩
  const [workoutTypes, setWorkoutTypes] = useState<WorkoutType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [showOtherWorkouts, setShowOtherWorkouts] = useState(savedDraft?.showOtherWorkouts ?? false); // 기타운동 표시 여부

  useEffect(() => {
    addLog(`MOUNT step=${savedDraftRef.current?.step ?? 'none'} hash=${window.location.hash} href=${window.location.href.slice(-30)}`, '#88f');
    const onVisibility = () => {
      addLog(`VISIBILITY → ${document.visibilityState} hash=${window.location.hash}`, '#ff8');
      if (document.visibilityState === 'visible') {
        // 외부 앱(파일앱·갤러리)에서 복귀 시 popstate가 늦게 오므로 여유 3초
        // 파일 선택 성공 시엔 handleImageChange onloadend에서 즉시 해제
        setTimeout(() => disableFilePickerGuard(), 3000);
      }
    };
    const onPageHide = (e: PageTransitionEvent) => addLog(`pagehide persisted=${e.persisted}`, e.persisted ? '#8f8' : '#f44');
    const onPopState = () => addLog(`POPSTATE hash=${window.location.hash} href=${window.location.href.slice(-40)}`, '#f0f');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('popstate', onPopState);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadWorkoutTypes = async () => {
      try {
        const types = await workoutTypeService.getActiveWorkoutTypes();
        setWorkoutTypes(types);
      } catch (error) {
        console.error('운동 종목 로드 실패:', error);
        alert('운동 종목을 불러오는데 실패했습니다.');
      } finally {
        setLoadingTypes(false);
      }
    };
    loadWorkoutTypes();
  }, []);

  // 이미지 복원 — 페이지 kill 후 재시작 시 (Samsung Internet, KakaoTalk WebView 등)
  useEffect(() => {
    const preview = savedDraftRef.current?.imagePreview;
    if (!preview) { addLog('IMG_RESTORE: no preview in draft', '#f88'); return; }
    addLog(`IMG_RESTORE: restoring ${Math.round(preview.length/1024)}kb`, '#8f8');
    setImagePreview(preview);
    try {
      const [header, data] = preview.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      setProofImage(new File([new Blob([bytes], { type: mime })], 'restored.jpg', { type: mime }));
      addLog('IMG_RESTORE: File 재구성 완료', '#8f8');
    } catch (e) { addLog(`IMG_RESTORE ERROR: ${e}`, '#f44'); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editWorkout || step === 4) return;
    const draft: AddWorkoutDraft = {
      step,
      category,
      subType,
      subTypeRatio,
      value,
      workoutDate,
      intensity,
      memo,
      showOtherWorkouts,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...draft, imagePreview }));
    } catch {
      // 이미지 포함 시 용량 초과 가능 — 이미지 빼고 재시도
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(draft)); } catch {}
    }
  }, [editWorkout, step, category, subType, subTypeRatio, value, workoutDate, intensity, memo, showOtherWorkouts, imagePreview]);

  useEffect(() => {
    if (step !== 4 || !shareClubId || !savedWorkout || !user) return;
    setShareNickname(null);
    setShareWorkoutNumber(undefined);
    Promise.all([
      clubService.getClubNickname(shareClubId, user.id),
      clubService.getWorkoutNumberInClub(savedWorkout.id, shareClubId, new Date(savedWorkout.workout_time)),
    ]).then(([nickname, workoutNumber]) => {
      setShareNickname(nickname);
      setShareWorkoutNumber(workoutNumber);
    }).catch(() => {});
  }, [step, shareClubId]);

  // 동적 카테고리 및 서브타입 매핑
  const CATEGORIES = workoutTypes.map((type) => ({
    id: type.name as WorkoutCategory,
    label: `${type.emoji} ${type.name}`,
    unit: type.unit as WorkoutUnit,
  }));

  const SUB_TYPES = workoutTypes.reduce((acc, type) => {
    acc[type.name] = type.sub_types || [];
    return acc;
  }, {} as Record<string, Array<{ name: string; unit: string }>>);

  const selectedCategory = CATEGORIES.find((c) => c.id === category);
  const selectedWorkoutType = workoutTypes.find((t) => t.name === category);
  const isMixedMode = selectedWorkoutType?.sub_type_mode === 'mixed';

  // 서브타입별 단위 동적 조회
  const getUnitForSubType = (): string => {
    if (subType && category) {
      const subTypes = SUB_TYPES[category];
      const selectedSubType = subTypes?.find((st) => st.name === subType);
      if (selectedSubType) {
        return selectedSubType.unit;
      }
    }
    return selectedWorkoutType?.unit || editWorkout?.unit || '값';
  };

  const displayUnit = getUnitForSubType();

  // 자릿수 네비게이터 — 동적 범위
  const maxCursorExp = displayUnit === 'm' ? 3 : 2;        // 최대: 백/천 자리
  const minCursorExp = displayUnit === 'km' ? -1 : 0;      // 최소: km=소수점, 나머지=정수
  const clampedExp   = Math.max(minCursorExp, Math.min(maxCursorExp, cursorExp));
  cursorExpRef.current = clampedExp;

  const numVal = parseFloat(value) || 0;
  // 현재 값의 최고 자리 exponent
  const hiFromVal = numVal >= 1 ? Math.floor(Math.log10(numVal)) : 0;
  // 현재 문자열의 최저 자리 exponent (소수점 아래)
  const loFromStr = (() => {
    const dot = (value || '').indexOf('.');
    return dot === -1 ? 0 : -(value.length - dot - 1);
  })();
  const hiExp = Math.max(clampedExp > 0 ? clampedExp : 0, hiFromVal);
  const loExp = Math.min(clampedExp < 0 ? clampedExp : 0, loFromStr);
  // 표시할 exponent 배열 (높은 → 낮은 순)
  const displayExps = Array.from({ length: hiExp - loExp + 1 }, (_, i) => hiExp - i);
  const getDigitAtExp = (exp: number): number =>
    exp >= 0
      ? Math.floor(numVal / Math.pow(10, exp)) % 10
      : Math.floor(numVal * Math.pow(10, -exp)) % 10;

  // 카테고리 선택
  const handleCategorySelect = (cat: WorkoutCategory) => {
    setCategory(cat);
    const subTypes = SUB_TYPES[cat];
    if (subTypes.length > 0) {
      setStep(2);
    } else {
      setSubType(null);
      setStep(3);
    }
  };

  // 세부 타입 선택
  const handleSubTypeSelect = (sub: string) => {
    setSubType(sub as WorkoutSubType);
    setStep(3);
  };

  // 이미지 선택
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 같은 파일 재선택 시 onChange 미발화 방지 — 항상 value 초기화
    e.target.value = '';
    addLog(`onChange fired: ${file ? file.name + ' ' + Math.round(file.size / 1024) + 'kb' : 'NULL'}`, file ? '#8f8' : '#f44');
    if (!file) return;

    setProofImage(file);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const full = reader.result as string;
      addLog(`FileReader done: ${Math.round(full.length / 1024)}kb`, '#8f8');

      // 대용량 사진 → canvas 압축 (localStorage 5MB 한도 대응)
      // 실패 시 원본 그대로 사용 (quota 오류는 아래에서 따로 처리)
      let toSave = full;
      if (full.length > 150 * 1024) {
        try {
          toSave = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              try {
                const ratio = Math.min(1, 1200 / Math.max(img.width, img.height, 1));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('no-ctx')); return; }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
              } catch (err) { reject(err); }
            };
            img.onerror = () => reject(new Error('img-load-failed'));
            img.src = full;
          });
          addLog(`compressed: ${Math.round(toSave.length / 1024)}kb`, '#8f8');
        } catch (err) {
          addLog(`compress FAILED (${err}) — using original`, '#f44');
          toSave = full; // 실패 시 원본 유지 (아래 quota 처리에서 걸러짐)
        }
      }

      try {
        const existing = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, imagePreview: toSave }));
        addLog('IMG_SAVED', '#8f8');
      } catch {
        addLog('IMG_SAVE FAILED quota — no restore on remount', '#f44');
        // 저장 실패해도 현재 세션은 setImagePreview로 표시 가능
      }
      disableFilePickerGuard();
      setImagePreview(toSave);
    };
    reader.onerror = () => { addLog(`FileReader ERROR: ${reader.error}`, '#f44'); disableFilePickerGuard(); };
    reader.readAsDataURL(file);
  };

  // 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !category || !value || parseFloat(value) <= 0) {
      alert('모든 필드를 올바르게 입력해주세요.');
      return;
    }

    if (!editWorkout) {
      const selectedTime = new Date(workoutDate);
      const nowCheck = new Date();
      if (selectedTime > nowCheck) {
        alert('미래 날짜는 기록할 수 없습니다.');
        return;
      }
      if (nowCheck.getTime() - selectedTime.getTime() > 48 * 60 * 60 * 1000) {
        alert('48시간 이전 기록은 추가할 수 없습니다.\n(최대 2일 전까지만 가능)');
        return;
      }
    }

    setUploading(true);

    // 수정 모드
    if (editWorkout) {
      try {
        let imageUrl: string | undefined;
        if (proofImage) {
          imageUrl = await uploadToR2(proofImage);
        }
        await workoutService.updateWorkout(editWorkout.id, {
          value: parseFloat(value),
          workout_time: new Date(workoutDate).toISOString(),
          intensity,
          memo: memo.trim() || undefined,
          proof_image: imageUrl ?? editWorkout.proof_image,
        });
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(DEBUG_LOG_KEY);
        navigate(-1);
      } catch (error) {
        console.error('운동 기록 수정 실패:', error);
        alert('운동 기록 수정에 실패했습니다.');
      } finally {
        setUploading(false);
      }
      return;
    }

    let workout: Workout | null = null;
    try {
      let imageUrl: string | undefined;

      // 이미지가 있으면 R2에 업로드
      if (proofImage) {
        console.log('🖼️ R2 업로드 시작...');
        try {
          imageUrl = await uploadToR2(proofImage);
          console.log('✅ R2 업로드 성공:', imageUrl);
        } catch (uploadError) {
          console.error('❌ R2 업로드 실패:', uploadError);
          alert('이미지 업로드에 실패했습니다. 이미지 없이 저장하시겠습니까?');
        }
      }

      // 서브타입 비율 계산 (복합형만)
      let subTypeRatios: Record<string, number> | undefined;
      if (isMixedMode && subTypeRatio > 0 && subTypeRatio < 100) {
        const subTypes = SUB_TYPES[category];
        subTypeRatios = {
          [subTypes[0].name]: (100 - subTypeRatio) / 100,
          [subTypes[1].name]: subTypeRatio / 100,
        };
      }

      // 운동 기록 저장
      console.log('💾 운동 기록 저장 시작...');
      workout = await workoutService.createWorkout({
        user_id: user.id,
        category,
        sub_type: subType,
        sub_type_ratios: subTypeRatios,
        value: parseFloat(value),
        unit: displayUnit as WorkoutUnit,
        intensity,
        proof_image: imageUrl,
        memo: memo.trim() || undefined,
        ...getDeviceInfo(),
        workout_time: new Date(workoutDate).toISOString(),
      });
      console.log('✅ 운동 기록 저장 성공');

    } catch (error) {
      console.error('❌ 운동 기록 저장 실패:', error);
      alert(`운동 기록 저장에 실패했습니다.\n${error instanceof Error ? error.message : ''}`);
      setUploading(false);
      return;
    }

      setUploading(false);

      const autoShare = localStorage.getItem(KAKAO_SHARE_KEY) !== 'false';
      if (autoShare && workout) {
      try {
        const clubs = await clubService.getMyClubs(user.id);
        setMyClubs(clubs);
        setShareClubId(clubs[0]?.id ?? '');
      } catch {
        // 클럽 조회 실패해도 공유 화면은 표시 (빈 목록으로)
      }
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(DEBUG_LOG_KEY);
      setSavedWorkout(workout);
      setStep(4);
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(DEBUG_LOG_KEY);
      navigate('/');
    }
  };

  // 자릿수 조정 (long-press repeat 지원)
  const adjustAtExp = (exp: number, delta: 1 | -1) => {
    const pv = Math.pow(10, exp);
    const maxVal = displayUnit === 'm' ? 9999 : displayUnit === 'km' ? 999.9 : 999;
    setValue(prev => {
      const str = prev || '0';
      const dot = str.indexOf('.');
      const currentDecimals = dot === -1 ? 0 : str.length - dot - 1;
      const resultDecimals = Math.max(currentDecimals, exp < 0 ? -exp : 0);
      const n = Math.min(maxVal, Math.max(0, (parseFloat(str) || 0) + delta * pv));
      return n.toFixed(resultDecimals);
    });
  };

  const startDigitStep = (delta: 1 | -1) => {
    const doAdjust = () => adjustAtExp(cursorExpRef.current, delta);
    doAdjust();
    stepTimerRef.current = setTimeout(() => {
      stepIntervalRef.current = setInterval(doAdjust, 100);
    }, 1000);
  };

  const stopStep = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
  };

  // 뒤로 가기
  const handleBack = () => {
    if (editWorkout) { navigate(-1); return; }
    if (step === 3) {
      const subTypes = category ? SUB_TYPES[category] : [];
      if (subTypes.length > 0) {
        setStep(2);
      } else {
        setStep(1);
      }
    } else if (step === 2) {
      setStep(1);
    } else {
      navigate(-1);
    }
  };

  // 운동 종목 로딩 중
  if (loadingTypes) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>운동 종목 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container add-workout-page">
      {/* 디버그 패널 — ?debug=1 로 활성화 */}
      {isDebug && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, maxHeight: showDebug ? '45vh' : '36px', background: '#111', color: '#fff', fontSize: '11px', fontFamily: 'monospace', transition: 'max-height .2s', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#333', cursor: 'pointer' }} onClick={() => setShowDebug(v => !v)}>
            <span>🐛 DEBUG {showDebug ? '▼' : '▲'}  img={imagePreview ? '✅' : '❌'}  file={proofImage ? '✅' : '❌'}  step={step}</span>
            <button type="button" style={{ background: '#f44', color: '#fff', border: 'none', borderRadius: 4, padding: '0 8px', fontSize: 11 }} onClick={e => { e.stopPropagation(); setDebugLogs([]); localStorage.removeItem(DEBUG_LOG_KEY); }}>Clear</button>
          </div>
          {showDebug && (
            <div style={{ overflowY: 'auto', maxHeight: 'calc(45vh - 36px)', padding: '4px 8px' }}>
              {debugLogs.length === 0 && <div style={{ color: '#888', padding: 4 }}>이벤트 없음 — 사진 추가 버튼을 눌러보세요</div>}
              {debugLogs.map((l, i) => (
                <div key={i} style={{ color: l.color, padding: '2px 0', borderBottom: '1px solid #222' }}>
                  <span style={{ color: '#888' }}>{l.t} </span>{l.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="detail-header">
        <button className="back-button" onClick={handleBack}>
          <ChevronLeft size={24} />
        </button>
        <h1>{editWorkout ? '운동 기록 수정' : '운동 기록 추가'}</h1>
      </div>

      <div className="add-workout-content">
        {/* Step 1: 카테고리 선택 */}
        {step === 1 && (
          <div className="category-selection">
            <h3>운동 종류를 선택하세요</h3>

            {/* 기본운동 */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--primary-color)' }}>
                ⭐ 기본운동
              </h4>
              <div className="category-buttons">
                {CATEGORIES.filter(cat => {
                  const workoutType = workoutTypes.find(t => t.name === cat.id);
                  return workoutType?.is_core;
                }).map((cat) => (
                  <button
                    key={cat.id}
                    className="category-button"
                    onClick={() => handleCategorySelect(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 기타운동 (접힘/펼침) */}
            <div>
              <button
                onClick={() => setShowOtherWorkouts(!showOtherWorkouts)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  marginBottom: showOtherWorkouts ? '12px' : '0',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                  📦 기타운동
                </span>
                <span style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                  {showOtherWorkouts ? '▼' : '▶'}
                </span>
              </button>

              {showOtherWorkouts && (
                <div className="category-buttons">
                  {CATEGORIES.filter(cat => {
                    const workoutType = workoutTypes.find(t => t.name === cat.id);
                    return !workoutType?.is_core;
                  }).map((cat) => (
                    <button
                      key={cat.id}
                      className="category-button"
                      onClick={() => handleCategorySelect(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: 세부 타입 선택 */}
        {step === 2 && category && (
          <div className="subtype-selection">
            <h3>{selectedCategory?.label} 세부 종류</h3>

            {/* 복합형: 비율 슬라이더 */}
            {isMixedMode ? (
              <div className="subtype-ratio-selector">
                <p className="ratio-description">
                  두 종류를 섞어서 했나요? 비율을 조정하세요.
                </p>

                <div className="ratio-labels">
                  <span className="ratio-label-left">{SUB_TYPES[category][0].name}</span>
                  <span className="ratio-label-right">{SUB_TYPES[category][1].name}</span>
                </div>

                <div className="ratio-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={subTypeRatio}
                    onChange={(e) => setSubTypeRatio(Number(e.target.value))}
                    className="ratio-slider"
                  />
                  <div className="ratio-values">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={100 - subTypeRatio}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 100) {
                          setSubTypeRatio(100 - val);
                        }
                      }}
                      className="ratio-input"
                    />
                    <span>%</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={subTypeRatio}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 100) {
                          setSubTypeRatio(val);
                        }
                      }}
                      className="ratio-input"
                    />
                    <span>%</span>
                  </div>
                </div>

                <button
                  className="primary-button"
                  onClick={() => {
                    // 비율이 0% 또는 100%면 단일 서브타입
                    if (subTypeRatio === 0) {
                      setSubType(SUB_TYPES[category][0].name as WorkoutSubType);
                    } else if (subTypeRatio === 100) {
                      setSubType(SUB_TYPES[category][1].name as WorkoutSubType);
                    } else {
                      // 혼합: 대표 서브타입을 첫 번째로 설정 (표시용)
                      setSubType(SUB_TYPES[category][0].name as WorkoutSubType);
                    }
                    setStep(3);
                  }}
                >
                  다음
                </button>
              </div>
            ) : (
              /* 선택형: 버튼 선택 */
              <div className="subtype-buttons">
                {SUB_TYPES[category].map((sub) => (
                  <button
                    key={sub.name}
                    className="subtype-button"
                    onClick={() => handleSubTypeSelect(sub.name)}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: 값 입력 — 전면 재설계 */}
        {step === 3 && category && (() => {
          const d = new Date(workoutDate);
          const WDAYS = ['일', '월', '화', '수', '목', '금', '토'];
          const h = d.getHours();
          const dateStr = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WDAYS[d.getDay()]})`;
          const timeStr = `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
          const activeIdx = DIFF_LEVELS.findIndex(l => intensity >= l.min && intensity <= l.max);

          return (
            <form onSubmit={handleSubmit} className="step3-form">

              {/* ① 날짜 카드 — 최상단, 컨텍스트 헤더 역할 */}
              <div
                className="step3-date-card"
                onClick={() => editWorkout
                  ? dateInputRef.current?.showPicker?.()
                  : setShowDatePicker(true)
                }
              >
                <div className="step3-date-inner">
                  <div className="step3-date-workout-name">
                    {selectedCategory?.label}
                    {isMixedMode && subTypeRatio > 0 && subTypeRatio < 100
                      ? <span className="step3-date-subtype"> · {SUB_TYPES[category][0].name} {100-subTypeRatio}% / {SUB_TYPES[category][1].name} {subTypeRatio}%</span>
                      : subType && <span className="step3-date-subtype"> · {subType}</span>
                    }
                  </div>
                  <div className="step3-date-main-row">
                    <div className="step3-date-datetime">
                      <span className="step3-date-big">{dateStr}</span>
                      <span className="step3-date-sep">·</span>
                      <span className="step3-date-time">{timeStr}</span>
                    </div>
                    <div className="step3-date-edit-chip">✎ 변경</div>
                  </div>
                </div>
                {/* datetime-local은 항상 DOM에 유지 (9a49807 구조 복원) —
                    Samsung Internet이 form 내 datetime-local 부재 시 파일피커 동작 달라짐 */}
                {(editWorkout || true) && (
                  <input
                    ref={dateInputRef}
                    type="datetime-local"
                    value={workoutDate}
                    onChange={(e) => setWorkoutDate(e.target.value)}
                    className="step3-date-hidden-input"
                    style={editWorkout ? undefined : { pointerEvents: 'none' }}
                  />
                )}
              </div>
              {showDatePicker && (
                <DatePickerSheet
                  value={workoutDate}
                  onChange={setWorkoutDate}
                  onClose={() => setShowDatePicker(false)}
                />
              )}

              {/* ② 수치 입력 — 자릿수 네비게이터 */}
              <div className="step3-value-card">
                <div className="step3-value-hint">{displayUnit}</div>

                {showDirectInput ? (
                  /* 직접 입력 모드 */
                  <div className="step3-direct-row">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onBlur={() => setShowDirectInput(false)}
                      className="step3-direct-input"
                      autoFocus
                      required
                    />
                    <span className="step3-direct-unit">{displayUnit}</span>
                  </div>
                ) : (
                  <>
                    {/* 휠피커: ‹ [자릿수별 +/숫자/-] › */}
                    <div className="step3-value-row">
                      <button type="button" className="step3-nav-arrow"
                        onClick={() => setCursorExp(e => Math.min(maxCursorExp, e + 1))}>‹</button>
                      <div className="step3-digit-display">
                        {displayExps.map(exp => {
                          const d = getDigitAtExp(exp);
                          const isActive = clampedExp === exp;
                          const isLeadingZero = !isActive && exp >= 0 && d === 0
                            && displayExps.filter(e => e > exp).every(e => getDigitAtExp(e) === 0);
                          return (
                            <span key={exp} className="step3-digit-slot">
                              {exp === -1 && <span className="step3-digit-dot">.</span>}
                              <div className={`step3-digit-col${isActive ? ' active' : ''}`}>
                                <button
                                  type="button"
                                  className="step3-digit-adj-btn step3-digit-adj-plus"
                                  onMouseDown={() => { if (touchActive.current) return; startDigitStep(1); }}
                                  onMouseUp={stopStep}
                                  onMouseLeave={stopStep}
                                  onTouchStart={(e) => { e.preventDefault(); touchActive.current = true; startDigitStep(1); }}
                                  onTouchEnd={() => { stopStep(); setTimeout(() => { touchActive.current = false; }, 300); }}
                                >+</button>
                                <button
                                  type="button"
                                  className={`step3-digit-box${isActive ? ' selected' : ''}${isLeadingZero ? ' dim' : ''}`}
                                  onClick={() => setCursorExp(exp)}
                                >{d}</button>
                                <button
                                  type="button"
                                  className="step3-digit-adj-btn step3-digit-adj-minus"
                                  onMouseDown={() => { if (touchActive.current) return; startDigitStep(-1); }}
                                  onMouseUp={stopStep}
                                  onMouseLeave={stopStep}
                                  onTouchStart={(e) => { e.preventDefault(); touchActive.current = true; startDigitStep(-1); }}
                                  onTouchEnd={() => { stopStep(); setTimeout(() => { touchActive.current = false; }, 300); }}
                                >−</button>
                              </div>
                            </span>
                          );
                        })}
                        <span className="step3-digit-unit-label">{displayUnit}</span>
                      </div>
                      <button type="button" className="step3-nav-arrow"
                        onClick={() => setCursorExp(e => Math.max(minCursorExp, e - 1))}>›</button>
                    </div>
                    <button type="button" className="step3-type-direct-btn"
                      onClick={() => setShowDirectInput(true)}>⌨️ 직접 입력</button>
                  </>
                )}

                <div className="step3-value-bar" />
              </div>

              {/* ③ 인증사진 카드 — 선택 */}
              <div className="step3-section-card step3-photo-card">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input-hidden"
                />
                <div className="step3-photo-header">
                  <div className="step3-photo-header-left">
                    <span className="step3-section-title">📸 인증사진</span>
                    <span className="step3-pill step3-pill-optional">선택</span>
                  </div>
                  {(imagePreview || editWorkout?.proof_image) ? (
                    <div
                      className="step3-photo-thumb"
                      onClick={() => { enableFilePickerGuard(); addLog('PICKER open (thumb/click)', '#ff8'); fileInputRef.current?.click(); }}
                    >
                      <img src={imagePreview ?? editWorkout?.proof_image} alt="미리보기" />
                      <div className="step3-photo-thumb-overlay">변경</div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="step3-photo-add-btn"
                      onClick={() => { enableFilePickerGuard(); addLog('PICKER open (gallery/click)', '#ff8'); fileInputRef.current?.click(); }}
                    >📷 사진 첨부</button>
                  )}
                </div>
                {showBrowserWarning && (
                  <div className="browser-warning-banner">
                    <span>
                      {isKakaoInApp
                        ? '카카오 인앱에서는 사진 선택이 불안정합니다. 우상단 ···메뉴 → 다른 브라우저로 열기를 이용해주세요.'
                        : '삼성 브라우저에서는 사진 선택이 불안정할 수 있습니다. Chrome 앱에서 열면 더 안정적입니다.'}
                    </span>
                    <button
                      type="button"
                      className="browser-warning-dismiss"
                      onClick={() => { localStorage.setItem('browser_warning_dismissed', '1'); setShowBrowserWarning(false); }}
                    >✕</button>
                  </div>
                )}
              </div>

              {/* ④ 메모 카드 */}
              <div className="step3-section-card step3-memo-card">
                <div className="step3-section-header">
                  <span className="step3-section-title">✏️ 메모</span>
                  <span className="step3-pill step3-pill-optional">선택</span>
                </div>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="오늘의 날씨, 컨디션, 느낀점..."
                  className="step3-memo-textarea"
                  rows={3}
                />
              </div>

              {/* ⑤ 난이도 카드 */}
              <div className="step3-section-card step3-diff-card">
                <div className="step3-section-header">
                  <span className="step3-section-title">체감 난이도</span>
                  {activeIdx >= 0 && (
                    <span className="step3-diff-current-label">
                      {DIFF_LEVELS[activeIdx].emoji} {DIFF_LEVELS[activeIdx].label}
                      <span className="step3-diff-intensity-num"> {intensity}</span>
                    </span>
                  )}
                </div>
                {/* 이모지 시각화 */}
                <div className="step3-diff-emoji-row">
                  {DIFF_LEVELS.map((lv, idx) => (
                    <div key={idx} className={`step3-diff-emoji-item${activeIdx === idx ? ' active' : ''}`}>
                      <span className="step3-diff-emoji-icon">{lv.emoji}</span>
                      <span className="step3-diff-emoji-name">{lv.label}</span>
                    </div>
                  ))}
                </div>
                {/* 슬라이더 1-10 */}
                <div className="step3-diff-slider-wrap">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="step3-diff-slider"
                    style={{
                      background: `linear-gradient(to right, #4FC3F7 0%, #4FC3F7 ${((intensity - 1) / 9) * 100}%, #E1E8ED ${((intensity - 1) / 9) * 100}%, #E1E8ED 100%)`
                    }}
                  />
                  <div className="step3-diff-ticks">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                      <span key={n} className={`step3-diff-tick${n === intensity ? ' active' : ''}`}>{n}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-actions-fixed">
                <button type="submit" className="primary-button-full" disabled={uploading}>
                  {uploading ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </form>
          );
        })()}

        {/* Step 4: 카톡 공유 */}
        {step === 4 && savedWorkout && (
          <div className="kakao-share-step">
            <div className="kakao-share-icon">💬</div>
            <h2 className="kakao-share-title">카톡으로 공유할까요?</h2>
            <p className="kakao-share-desc">공유할 클럽을 선택하세요</p>

            {myClubs.length > 0 ? (
              <>
                <select
                  className="kakao-share-select"
                  value={shareClubId}
                  onChange={e => setShareClubId(e.target.value)}
                >
                  {myClubs.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="kakao-share-info">
                  <p className="kakao-share-info-name">{shareNickname ?? '회원'}</p>
                  {shareWorkoutNumber && <p className="kakao-share-info-number">오늘 클럽 {shareWorkoutNumber}번째 🏅</p>}
                </div>
              </>
            ) : (
              <p className="kakao-share-no-club">가입된 클럽이 없습니다</p>
            )}

            <div className="kakao-share-actions">
              {myClubs.length > 0 && (
                <button
                  className="kakao-share-btn"
                  onClick={() => {
                    if (!window.Kakao?.isInitialized()) { navigate('/'); return; }
                    const club = myClubs.find(c => c.id === shareClubId);
                    const appUrl = `${window.location.origin}/workout/${savedWorkout.id}?clubId=${shareClubId}`;
                    const displayName = shareNickname ?? '회원';
                    const numberText = shareWorkoutNumber ? `\n오늘 클럽 ${shareWorkoutNumber}번째` : '';
                    const workoutDate = new Date(savedWorkout.workout_time);
                    const dateStr = `${workoutDate.getFullYear()}.${String(workoutDate.getMonth() + 1).padStart(2, '0')}.${String(workoutDate.getDate()).padStart(2, '0')}`;
                    const workoutLabel = savedWorkout.sub_type
                      ? `${savedWorkout.category}-${savedWorkout.sub_type}`
                      : savedWorkout.category;
                    const shareData: any = {
                      objectType: 'feed',
                      content: {
                        title: `[${club?.name ?? ''}] ${displayName}님 (${dateStr})`,
                        description: `${workoutLabel}: ${savedWorkout.value}${savedWorkout.unit}${numberText}`,
                        link: { mobileWebUrl: appUrl, webUrl: appUrl },
                      },
                      buttons: [{ title: '나도 기록하기', link: { mobileWebUrl: appUrl, webUrl: appUrl } }],
                    };
                    if (savedWorkout.proof_image) shareData.content.imageUrl = savedWorkout.proof_image;
                    window.Kakao.Share.sendDefault(shareData);
                    localStorage.removeItem(SESSION_KEY);
                    localStorage.removeItem(DEBUG_LOG_KEY);
                    navigate('/');
                  }}
                >
                  카카오톡 공유
                </button>
              )}
              <button className="kakao-share-skip" onClick={() => { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(DEBUG_LOG_KEY); navigate('/'); }}>
                건너뛰기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
