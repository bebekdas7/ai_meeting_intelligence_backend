import actionItemModel from "../model/actionItemModel";
import Busboy from "busboy";
import stream from "stream";
import { Request, Response } from "express";
import { saveMeetingVideo } from "../service/meetingService";
import { publishJob } from "../service/rabbitmq";
import meetingModel from "../model/meetingModel";
import { buildVideoPath } from "../util/upload";
import { RESPONSE_MESSAGES } from "../constant/responseMessage";
import { httpResponse } from "../util/httpResponse";
import { logger, logControllerError } from "../util/logger";
const { filterSensitive } = require("../util/logger");

/**
 * Get user dashboard stats: total meetings, pending action items, completed action items, pending meetings
 * @route GET /api/meetings/dashboard
 * @access Authenticated users
 */
export const getUserMeetingDashboard = async (req: Request, res: Response) => {
  logger.info("Get user meeting dashboard request", {
    userId: req.user?.userId,
  });
  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    // Total meetings
    const meetings = await meetingModel.getMeetingByUserId(userId);
    const totalMeetings = meetings.length;
    // Pending meetings
    const pendingMeetings = meetings.filter(
      (m: any) => m.status === "pending",
    ).length;
    // All action items for user's meetings
    const meetingIds = meetings.map((m: any) => m.id);
    let pendingActionItems = 0;
    let completedActionItems = 0;
    if (meetingIds.length > 0) {
      const result =
        await actionItemModel.getActionItemsByMeetingIds(meetingIds);
      pendingActionItems = result.filter(
        (a: any) => a.status === "pending",
      ).length;
      completedActionItems = result.filter(
        (a: any) => a.status === "completed",
      ).length;
    }
    return res.json({
      totalMeetings,
      pendingMeetings,
      pendingActionItems,
      completedActionItems,
    });
  } catch (error) {
    logControllerError(logger, "Error fetching user dashboard", error, req);
    return res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

/**
 * Upload a meeting video for processing.
 *
 * @route POST /api/meetings/upload
 * @access Authenticated users (user, admin)
 * @param req - Express request (expects video file in multipart form-data)
 * @param res - Express response
 * @returns {Object} 200 - { meetingId }
 * @returns {Object} 400/401/500 - Error message
 */
export const uploadMeetingVideo = async (req: Request, res: Response) => {
  logger.info("Upload meeting video request received", {
    userId: req.user?.userId,
  });
  // 100MB file size limit
  const busboy = Busboy({
    headers: req.headers,
    limits: { fileSize: 100 * 1024 * 1024 },
  });
  let responseSent = false;

  const sendErrorOnce = (status: number, body: object) => {
    if (!responseSent) {
      responseSent = true;
      logger.warn("Upload meeting video error", { status, body });
      res.status(status).json(body);
    }
  };

  const sendSuccessOnce = (status: number, message: string, data: unknown) => {
    if (!responseSent) {
      responseSent = true;
      logger.info("Upload meeting video success", { status, message, data });
      httpResponse(res, status, message, data);
    }
  };

  busboy.on("file", (_fieldname, file, info) => {
    const { filename, mimeType } = info;
    logger.debug("File received for upload", { filename, mimeType });

    // Validate MIME type (client-provided, not trusted)
    if (!mimeType || !mimeType.startsWith("video/")) {
      file.resume();
      sendErrorOnce(400, { error: RESPONSE_MESSAGES.ONLY_VIDEO_ALLOWED });
      return;
    }

    // Get userId from req.user (set by auth middleware)
    const userId = req.user?.userId;
    if (!userId) {
      file.resume();
      sendErrorOnce(401, { error: "Unauthorized: userId missing" });
      return;
    }

    // Buffer the first 16 bytes to check magic number
    const headerChunks: Buffer[] = [];
    let headerBytes = 0;
    let headerChecked = false;
    const MAX_HEADER_BYTES = 16;
    const passThrough = new stream.PassThrough();

    file.on("data", (chunk) => {
      if (!headerChecked && headerBytes < MAX_HEADER_BYTES) {
        const needed = MAX_HEADER_BYTES - headerBytes;
        headerChunks.push(chunk.slice(0, needed));
        headerBytes += chunk.length;
        if (headerBytes >= MAX_HEADER_BYTES) {
          const header = Buffer.concat(headerChunks, MAX_HEADER_BYTES);
          // Check for common video file signatures (MP4, WebM, MKV)
          const isMp4 = header.slice(4, 8).toString() === "ftyp";
          const isWebM = header.slice(0, 4).toString() === "\x1A\x45\xDF\xA3";
          const isMkv = header.slice(0, 4).toString("hex") === "1a45dfa3";
          if (!(isMp4 || isWebM || isMkv)) {
            file.unpipe(passThrough);
            file.resume();
            sendErrorOnce(400, {
              error: "Invalid or unsupported video file format.",
            });
            headerChecked = true;
            return;
          }
          headerChecked = true;
        }
      }
      passThrough.write(chunk);
    });

    file.on("end", () => {
      passThrough.end();
    });

    (async () => {
      try {
        // 1. Create meeting record in DB (get canonical id)
        const meeting = await meetingModel.createMeeting(userId, "", "");
        const meetingId = meeting.id;
        logger.info("Meeting record created", { meetingId, userId });

        // 2. Build video path using DB id
        const videoPath = buildVideoPath(meetingId, filename);

        // 3. Save video file (from passThrough, not file directly)
        await saveMeetingVideo(meetingId, videoPath, passThrough, userId);
        logger.info("Video file saved", { meetingId, videoPath });

        // 4. Update meeting record with video path
        await meetingModel.updateMeetingVideoPath(meetingId, videoPath);
        await meetingModel.updateMeetingResults(meetingId, {
          audioPath: "",
          transcript: "",
          summary: "",
          status: "uploaded",
        });
        logger.info("Meeting record updated after upload", { meetingId });

        // 5. Publish job to RabbitMQ for async processing
        publishJob({ meetingId, userId, video: videoPath });
        logger.info("Job published to RabbitMQ", { meetingId });

        sendSuccessOnce(200, RESPONSE_MESSAGES.UPLOAD_SUCCESS, { meetingId });
      } catch (error) {
        // Filter sensitive headers before logging
        logControllerError(logger, "Meeting upload error", error, req, {
          reqHeaders: filterSensitive(req.headers),
          reqFileInfo: info,
        });
        const message =
          error instanceof Error
            ? error.message
            : RESPONSE_MESSAGES.AUDIO_EXTRACTION_FAILED;
        sendErrorOnce(500, { error: message });
      }
    })();
  });
  busboy.on("filesLimit", () => {
    sendErrorOnce(400, { error: "File size limit exceeded (100MB max)." });
  });

  req.pipe(busboy);
};

/**
 * Get all meetings for the logged-in user.
 *
 * @route GET /api/meetings/my-meetings
 * @access Authenticated users
 * @param req - Express request (expects JWT auth)
 * @param res - Express response
 * @returns {Object} 200 - { meetings: Meeting[] }
 * @returns {Object} 401/500 - Error message
 */
export const getMeetingsForUser = async (req: Request, res: Response) => {
  logger.info("Get meetings for user request", { userId: req.user?.userId });
  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    const meetings = await meetingModel.getMeetingByUserId(userId);
    logger.info("Meetings fetched for user", {
      userId,
      count: meetings.length,
    });
    return res.json({ meetings });
  } catch (error) {
    logControllerError(logger, "Error fetching meetings for user", error, req);
    return res.status(500).json({ error: "Failed to fetch meetings" });
  }
};

/**
 * Retry processing a failed meeting video.
 * @route POST /api/meetings/:meetingId/retry
 * @access Authenticated users (user, admin)
 */
export const retryMeetingProcessing = async (req: Request, res: Response) => {
  let meetingId = req.params.meetingId;
  if (Array.isArray(meetingId)) meetingId = meetingId[0];
  if (!meetingId || typeof meetingId !== "string") {
    return res.status(400).json({ error: "Invalid meetingId parameter" });
  }
  const userId = req.user?.userId;
  try {
    const meeting = await meetingModel.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    if (meeting.status !== "failed") {
      return res.status(400).json({ error: "Meeting is not in failed state" });
    }
    if (!meeting.video_path) {
      return res
        .status(400)
        .json({ error: "No video file found for this meeting" });
    }
    // Publish job to RabbitMQ for retry
    await publishJob({ meetingId, userId, video: meeting.video_path });
    return res.json({ success: true, message: "Retry initiated" });
  } catch (error) {
    logControllerError(logger, "Retry meeting processing error", error, req);
    return res
      .status(500)
      .json({ error: "Failed to retry meeting processing" });
  }
};

/**
 * Get the most recent meeting for the logged-in user.
 *
 * @route GET /api/meetings/recent
 * @access Authenticated users
 * @param req - Express request (expects JWT auth)
 * @param res - Express response
 * @returns {Object} 200 - { meeting: Meeting | null }
 * @returns {Object} 401/500 - Error message
 */
export const getMostRecentMeetingForUser = async (
  req: Request,
  res: Response,
) => {
  logger.info("Get 5 most recent meetings for user request", {
    userId: req.user?.userId,
  });
  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    const meetings = await meetingModel.getMeetingByUserId(userId, {
      recent: 5,
    });
    logger.info("Most recent meetings fetched for user", {
      userId,
      count: Array.isArray(meetings) ? meetings.length : 0,
    });
    return res.json({ meetings });
  } catch (error) {
    logControllerError(
      logger,
      "Error fetching most recent meetings for user",
      error,
      req,
    );
    return res
      .status(500)
      .json({ error: "Failed to fetch most recent meetings" });
  }
};

/**
 * Get meeting details by meeting ID.
 *
 * @route GET /api/meetings/:meetingId
 * @access Authenticated users
 * @param req - Express request (expects JWT auth)
 * @param res - Express response
 * @returns {Object} 200 - { meeting: Meeting | null }
 * @returns {Object} 401/404/500 - Error message
 */
export const getMeetingById = async (req: Request, res: Response) => {
  logger.info("Get meeting by ID request", {
    userId: req.user?.userId,
    meetingId: req.params.meetingId,
  });
  try {
    const userId = req.user?.userId;
    let meetingId = req.params.meetingId;
    if (Array.isArray(meetingId)) meetingId = meetingId[0];
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    if (!meetingId || typeof meetingId !== "string") {
      return res
        .status(400)
        .json({ error: "Missing or invalid meetingId parameter" });
    }
    const meeting = await meetingModel.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    // Optionally, restrict access to only the meeting owner
    if (meeting.user_id !== userId) {
      return res.status(403).json({ error: "Forbidden: not your meeting" });
    }
    return res.json({ meeting });
  } catch (error) {
    logControllerError(logger, "Error fetching meeting by ID", error, req);
    return res.status(500).json({ error: "Failed to fetch meeting" });
  }
};
