import ffmpeg from "fluent-ffmpeg";
import ffprobeStatic from "ffprobe-static";

// Use system ffmpeg/ffprobe binaries (installed via apt-get in Docker or system package manager)
// In production Docker, FFmpeg is installed via: apt-get install ffmpeg
// In development, you should have FFmpeg installed on your system
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Optional: Explicitly set ffmpeg path if needed (usually not necessary if ffmpeg is in PATH)
// ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");

export { ffmpeg };

export function extractAudio(
  videoPath: string,
  outputAudioPath: string,
): Promise<void> {
  console.log("Extracting audio from video", { videoPath, outputAudioPath });
  return new Promise((resolve, reject) => {
    console.log("Starting ffmpeg audio extraction");
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .save(outputAudioPath)
      .on("end", () => {
        console.log("Audio extraction finished");
        resolve();
      })
      .on("error", (err: Error) => {
        console.error("Error during audio extraction:", err);
        reject(err);
      });
  });
}
