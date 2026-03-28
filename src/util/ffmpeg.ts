import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath as string);

export function extractAudio(videoPath: string, outputAudioPath: string): Promise<void> {
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