/**
 * 음성을 텍스트로 변환 (서버사이드 호출)
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioBlob);

  const response = await fetch('/.netlify/functions/transcribe-audio', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: 'Unknown error'
    }));
    throw new Error(`Transcription Error (${response.status}): ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  return data.text;
}
