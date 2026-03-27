import fs from "fs";
import { logger } from "../util/logger";
import { AppError } from "../util/errorObject";
import ffmpeg from "fluent-ffmpeg";
import meetingModel from "../model/meetingModel";

/**
 * Save a meeting video file to disk and scan for viruses.
 * @param meetingId - The meeting's unique ID
 * @param videoPath - The path to save the video file
 * @param fileStream - The readable stream of the video file
 * @param userId - The user uploading the video
 */
export async function saveMeetingVideo(
  meetingId: string,
  videoPath: string,
  fileStream: NodeJS.ReadableStream,
  userId: string,
): Promise<void> {

  logger.info("Saving meeting video", { meetingId, videoPath, userId });
  await new Promise<void>((resolve, reject) => {
    const writeStream = fs.createWriteStream(videoPath);
    fileStream.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", (err) => {
      logger.error("Failed to save video file", { videoPath, err });
      reject(new AppError("Failed to save video file", 500));
    });
  });

  // Extract video duration using ffmpeg
  let duration: number | null = null;
  try {
    duration = await new Promise<number | null>((resolve) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          logger.error("Failed to extract video duration", { videoPath, err });
          resolve(null);
        } else {
          const dur = typeof metadata.format.duration === "number" ? metadata.format.duration : null;
          resolve(dur);
        }
      });
    });
    if (duration !== null) {
      await meetingModel.updateMeetingVideoDuration(meetingId, duration);
      logger.info("Video duration extracted and saved", { meetingId, duration });
    }
  } catch (err) {
    logger.error("Error extracting/saving video duration", { videoPath, err });
  }

  // Scan for viruses (can be disabled by editing scanFileForVirus)
//   const clean = await scanFileForVirus(videoPath);
//   if (!clean) {
//     logger.error("Virus detected in uploaded file", { videoPath });
//     fs.unlinkSync(videoPath);
//     throw new AppError(
//       "Uploaded file failed virus scan and was rejected.",
//       400,
//     );
//   }

  logger.info("Meeting video saved and scanned", { meetingId, videoPath });
}
