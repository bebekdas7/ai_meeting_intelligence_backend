import fs from "fs";
import path from "path";
import { UPLOAD_DIRS } from "../constant/application";

export function ensureUploadDirs(): void {
  [UPLOAD_DIRS.VIDEO, UPLOAD_DIRS.AUDIO].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-50);
}

export function buildVideoPath(meetingId: string, filename: string): string {
  console.log("Building video path", { meetingId, filename });
  const safeFilename = sanitizeFilename(filename);
  const ext = path.extname(safeFilename);
  return path.join(UPLOAD_DIRS.VIDEO, `${meetingId}${ext}`);
}

export function buildAudioPath(meetingId: string): string {
  console.log("Building audio path", { meetingId });
  return path.join(UPLOAD_DIRS.AUDIO, `${meetingId}.mp3`);
}
