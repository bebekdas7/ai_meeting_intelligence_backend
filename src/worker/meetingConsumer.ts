import "dotenv/config";
import amqp from "amqplib";
import express from "express";
import { extractAudio, ffmpeg } from "../util/ffmpeg";
import axios from "axios";
import fs from "fs";
import path from "path";
import { transcribeAudio } from "../service/transcriptionService";
import meetingModel from "../model/meetingModel";
import { buildAudioPath } from "../util/upload";
import { extractActionItems } from "../service/actionItemService";
import { generateMeetingSummary } from "../service/summaryService";
import actionItemModel from "../model/actionItemModel";
import { logger } from "../util/logger";
import cloudinary from "../config/cloudinary";

const QUEUE_NAME = "meeting_video_processing";
const healthApp = express();

// Main consumer for meeting video processing jobs
async function startConsumer() {
  // Connect to RabbitMQ
  logger.info("Starting meeting video processing consumer");
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost",
  );
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  // LIMIT concurrency to 1 job at a time
  channel.prefetch(1);
  logger.info("[Consumer] Waiting for messages in queue", { QUEUE_NAME });

  // Start consuming jobs from the queue
  channel.consume(
    QUEUE_NAME,
    async (msg) => {
      if (!msg) return;
      try {
        // Parse job payload
        const job = JSON.parse(msg.content.toString());
        const { meetingId, video } = job;
        logger.info("[Consumer] Processings meeting bro", { job, meetingId });

        console.log(
          "Received job for meetingId:",
          meetingId,
          "video path:",
          video,
        );

        // 1. Download video from Cloudinary URL to temp file
        const tempVideoPath = path.join(
          __dirname,
          `temp_${meetingId}_${Date.now()}.mp4`,
        );
        logger.info("[Consumer] Downloading video from Cloudinary", {
          meetingId,
          video,
        });
        const writer = fs.createWriteStream(tempVideoPath);
        const response = await axios({
          method: "get",
          url: video,
          responseType: "stream",
        });
        await new Promise((resolve, reject) => {
          response.data.pipe(writer);
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
        logger.info("[Consumer] Video downloaded", {
          meetingId,
          tempVideoPath,
        });

        // 2. Extract audio from downloaded video file using ffmpeg
        const audioPath = buildAudioPath(meetingId);
        await extractAudio(tempVideoPath, audioPath);
        logger.info("[Consumer] Audio extracted", { meetingId, audioPath });

        // 2b. Extract video duration from the downloaded temp file
        let videoDuration: number | null = null;
        try {
          videoDuration = await new Promise<number | null>((resolve) => {
            ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
              if (err) {
                logger.error("[Consumer] Failed to extract video duration", {
                  meetingId,
                  err,
                });
                resolve(null);
              } else {
                const dur =
                  typeof metadata.format.duration === "number"
                    ? metadata.format.duration
                    : null;
                resolve(dur);
              }
            });
          });
          if (videoDuration !== null) {
            await meetingModel.updateMeetingVideoDuration(
              meetingId,
              videoDuration,
            );
            logger.info("[Consumer] Video duration extracted and saved", {
              meetingId,
              videoDuration,
            });
          }
        } catch (err) {
          logger.error("[Consumer] Error extracting video duration", {
            meetingId,
            err,
          });
        }

        // 3. Transcribe audio to text using OpenAI Whisper (before deleting audio file)
        const transcript = await transcribeAudio(audioPath);
        logger.info("[Consumer] Audio transcribed", { meetingId });

        // 4. Upload audio file to Cloudinary (after transcription)
        let audioCloudinaryUrl = "";
        try {
          const audioUploadResult = await cloudinary.uploader.upload(
            audioPath,
            {
              resource_type: "video", // Use 'raw' for mp3 audio
              folder: "meeting_audios",
              public_id: `${meetingId}`,
              format: "mp3",
            },
          );
          audioCloudinaryUrl =
            audioUploadResult.secure_url || audioUploadResult.url;
          logger.info("[Consumer] Audio uploaded to Cloudinary", {
            meetingId,
            audioCloudinaryUrl,
          });
        } catch (err) {
          logger.error("[Consumer] Failed to upload audio to Cloudinary", {
            meetingId,
            err,
          });
        }

        // 5. Clean up temp video and audio files
        try {
          fs.unlinkSync(tempVideoPath);
          logger.info("[Consumer] Temp video file deleted", { meetingId });
        } catch (err) {
          logger.warn("[Consumer] Failed to delete temp video file", {
            meetingId,
            err,
          });
        }
        try {
          fs.unlinkSync(audioPath);
          logger.info("[Consumer] Temp audio file deleted", { meetingId });
        } catch (err) {
          logger.warn("[Consumer] Failed to delete temp audio file", {
            meetingId,
            err,
          });
        }

        logger.info("[Consumer] Starting summary generation");
        // 3. Generate summary using summaryService
        const summary = await generateMeetingSummary(
          transcript,
          meetingId,
          process.env.OPENAI_API_KEY || "",
        );

        // 4. Generate a title using AI (OpenAI GPT)
        let title = "";
        try {
          const openai = require("openai");
          const openaiClient = new openai.OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });
          const prompt = `Generate a concise, descriptive title for this meeting transcript:\n${transcript.slice(0, 1000)}`;
          const completion = await openaiClient.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are a helpful assistant that creates meeting titles.",
              },
              { role: "user", content: prompt },
            ],
            max_tokens: 20,
            temperature: 0.7,
          });
          title = completion.choices[0]?.message?.content?.trim() || "";
          logger.info("[Consumer] Title generated", { meetingId, title });
        } catch (err) {
          logger.error("[Consumer] Failed to generate title", {
            meetingId,
            err,
          });
        }

        // 5. Extract and persist action items (idempotent)
        //    - Uses LLM to extract action items from the full transcript
        //    - Deletes old action items for this meeting
        //    - Bulk inserts new action items
        console.log("Transcript before action item extraction:", transcript);
        const actionItems = await extractActionItems(transcript);
        logger.info("[Consumer] Action items extracted", {
          meetingId,
          count: actionItems.length,
        });
        await actionItemModel.deleteByMeetingId(meetingId);
        await actionItemModel.bulkInsertActionItems(meetingId, actionItems);
        logger.info("[Consumer] Action items persisted", { meetingId });

        // 6. Update meeting record in DB with results (including title and Cloudinary audio URL)
        await meetingModel.updateMeetingResultsWithTitle(meetingId, {
          audioPath: audioCloudinaryUrl,
          transcript,
          summary,
          status: "completed",
          title,
        });
        logger.info("[Consumer] Meeting record updated", { meetingId });

        logger.info(`[Consumer] Completed meetingId=${meetingId}`);
        channel.ack(msg);
      } catch (err) {
        // Error handling and retry logic
        logger.error("[Consumer] Error processing job", { err });
        try {
          const job = JSON.parse(msg.content.toString());
          // Update meeting status to 'failed' in DB
          await meetingModel.updateMeetingResults(job.meetingId, {
            audioPath: "",
            transcript: "",
            summary: "",
            status: "failed",
          });
          let retries = job.retries || 0;
          if (retries < 3) {
            // Requeue job with incremented retry count
            channel.sendToQueue(
              QUEUE_NAME,
              Buffer.from(JSON.stringify({ ...job, retries: retries + 1 })),
              { persistent: true },
            );
            logger.warn(
              `[Consumer] Retrying job meetingId=${job.meetingId}, attempt ${retries + 1}`,
            );
          }
        } catch (parseErr) {
          logger.error("[Consumer] Failed to parse job for retry", {
            parseErr,
          });
        }
        channel.ack(msg);
      }
    },
    { noAck: false },
  );
}

// Start the consumer on process launch
startConsumer().catch((err) => {
  logger.error("[Consumer] Fatal error", { err });
  process.exit(1);
});

// Health check server for worker
healthApp.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
const HEALTH_PORT = process.env.PORT || 4001;
healthApp.listen(HEALTH_PORT, () => {
  logger.info(
    `[Consumer] Health check endpoint running on port ${HEALTH_PORT}`,
  );
});
