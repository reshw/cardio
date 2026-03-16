import type { Handler, HandlerEvent } from "@netlify/functions";
import { transcribeAudioWithGemini } from "./utils/ai-providers";
import { Readable } from 'stream';

// Parse multipart form data (simple implementation for audio blob)
async function parseMultipartFormData(body: string, boundary: string): Promise<{ audioData: string; mimeType: string } | null> {
  try {
    const parts = body.split(boundary);

    for (const part of parts) {
      if (part.includes('Content-Disposition') && part.includes('name="audio"')) {
        // Extract content type
        const contentTypeMatch = part.match(/Content-Type:\s*(.+)/i);
        const mimeType = contentTypeMatch ? contentTypeMatch[1].trim() : 'audio/webm';

        // Extract binary data after headers
        const dataStartIndex = part.indexOf('\r\n\r\n');
        if (dataStartIndex !== -1) {
          const binaryData = part.substring(dataStartIndex + 4);
          // Remove trailing boundary markers
          const cleanData = binaryData.replace(/\r\n--.*$/, '');

          // Convert to base64
          const base64Data = Buffer.from(cleanData, 'binary').toString('base64');

          return { audioData: base64Data, mimeType };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[transcribe-audio] Parse error:', error);
    return null;
  }
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    // Parse multipart form data
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);

    if (!boundaryMatch) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid content-type, boundary not found" })
      };
    }

    const boundary = '--' + boundaryMatch[1];
    const body = event.body || '';

    // Parse form data
    const parsed = await parseMultipartFormData(body, boundary);

    if (!parsed || !parsed.audioData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Audio data not found in request" })
      };
    }

    console.log('[transcribe-audio] Transcribing audio...');

    const text = await transcribeAudioWithGemini(parsed.audioData, parsed.mimeType);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    };

  } catch (error) {
    console.error("[transcribe-audio] Error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Transcription failed",
        details: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
