import OpenAI from "openai";
import fs from "fs";
import { logger } from "../util/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 2 minutes timeout for long audio processing
});

export async function transcribeAudio(audioPath: string) {
  logger.info("Transcribing audio", { audioPath });
  try {
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
    });
    logger.info("Audio transcription complete", { audioPath });
    return response.text;
  } catch (err: any) {
    console.error("Raw transcription error:", err);
    logger.error("Audio transcription failed", {
      audioPath,
      errorMessage: err?.message,
      errorStack: err?.stack,
      error: err,
    });
    throw err;
  }
}
