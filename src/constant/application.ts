import path from "path";

export const UPLOAD_DIRS = {
  VIDEO: path.join("uploads", "videos"),
  AUDIO: path.join("uploads", "audios"),
} as const;

export const ALLOWED_VIDEO_MIME_TYPES = ["video/"] as const;
