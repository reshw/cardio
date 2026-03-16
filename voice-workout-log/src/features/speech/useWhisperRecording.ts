import { useState, useRef, useCallback } from 'react';
import { transcribeAudio } from '../../utils/ai/transcribeAPI';

interface WhisperRecordingResult {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => Promise<string>;
  resetTranscript: () => void;
}

export const useWhisperRecording = (): WhisperRecordingResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveTranscriptionRef = useRef<((text: string) => void) | null>(null);

  const handleTranscribeAudio = useCallback(async (audioBlob: Blob) => {
    console.log('[Audio Transcription] Audio blob size:', audioBlob.size);

    try {
      console.log('[Audio Transcription] Sending audio transcription request...');

      const text = await transcribeAudio(audioBlob);
      console.log('[Audio Transcription] Transcription result:', text);
      setTranscript(text);

      // Promise resolve
      if (resolveTranscriptionRef.current) {
        resolveTranscriptionRef.current(text);
        resolveTranscriptionRef.current = null;
      }
    } catch (err) {
      console.error('[Audio Transcription] Transcription error:', err);
      setError(`음성 인식 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);

      // Promise resolve with error
      if (resolveTranscriptionRef.current) {
        resolveTranscriptionRef.current('');
        resolveTranscriptionRef.current = null;
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleTranscribeAudio(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('마이크 권한이 필요합니다.');
      setIsRecording(false);
    }
  }, [handleTranscribeAudio]);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        resolveTranscriptionRef.current = resolve;
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      } else {
        resolve('');
      }
    });
  }, [isRecording]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
    resetTranscript,
  };
};
