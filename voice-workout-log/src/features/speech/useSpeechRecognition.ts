import { useState, useEffect, useRef, useCallback } from 'react';
import type { SpeechRecognitionHookResult } from '../../types';

export const useSpeechRecognition = (): SpeechRecognitionHookResult => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptPiece + ' ';
        } else {
          interim += transcriptPiece;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      let errorMessage = '';
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          errorMessage = '마이크 권한이 필요합니다. 브라우저 설정에서 마이크 접근을 허용해주세요.';
          break;
        case 'no-speech':
          errorMessage = '음성이 감지되지 않았습니다.';
          break;
        case 'network':
          errorMessage = '네트워크 오류가 발생했습니다.';
          break;
        case 'aborted':
          errorMessage = '음성 인식이 중단되었습니다.';
          break;
        default:
          errorMessage = `음성 인식 오류: ${event.error}`;
      }

      setError(errorMessage);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.');
      return;
    }

    if (recognitionRef.current && !isListening) {
      setError(null);
      setInterimTranscript('');
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setError('음성 인식을 시작할 수 없습니다.');
      }
    }
  }, [isListening, isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
};
