import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath as string);

export function extractAudio(videoPath: string, outputAudioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .save(outputAudioPath)
      .on("end", () => {
        console.log("Audio extraction finished");
        resolve();
      })
      .on("error", (err: Error) => {
        reject(err);
      });
  });
}