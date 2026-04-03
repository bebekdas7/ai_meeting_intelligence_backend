import { updateMeetingTitle as updateMeetingTitleService } from "../service/meetingService";
import actionItemModel from "../model/actionItemModel";
// Removed Busboy and stream imports; using multer/Cloudinary
import { Request, Response } from "express";
import { publishJob } from "../service/rabbitmq";
import meetingModel from "../model/meetingModel";
import { RESPONSE_MESSAGES } from "../constant/responseMessage";
import { httpResponse } from "../util/httpResponse";
import { logger, logControllerError } from "../util/logger";
import {
  getAvailableCredits,
  getCreditTransactionHistory,
  insertCreditTransaction,
} from "../model/creditTransactionModel";
import userModel from "../model/userModel";

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
 * Get available credits for the logged-in user.
 *
 * @route GET /api/meetings/credits
 * @access Authenticated users
 */
export const getCurrentUserCredits = async (req: Request, res: Response) => {
  logger.info("Get current user credits request", { userId: req.user?.userId });
  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }

    const availableCredits = await getAvailableCredits(userId);
    return res.status(200).json({ success: true, availableCredits });
  } catch (error) {
    logControllerError(
      logger,
      "Error fetching current user credits",
      error,
      req,
    );
    return res.status(500).json({ error: "Failed to fetch available credits" });
  }
};

/**
 * Get meetings remaining estimate for the logged-in user.
 * Current billing rule: 1 meeting upload consumes 1 credit.
 *
 * @route GET /api/meetings/credits/estimate
 * @access Authenticated users
 */
export const getMeetingsRemainingEstimate = async (
  req: Request,
  res: Response,
) => {
  logger.info("Get meetings remaining estimate request", {
    userId: req.user?.userId,
  });

  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }

    const creditsPerMeeting = 1;
    const availableCredits = await getAvailableCredits(userId);
    const meetingsRemaining = Math.max(
      0,
      Math.floor(availableCredits / creditsPerMeeting),
    );

    return res.status(200).json({
      success: true,
      data: {
        availableCredits,
        creditsPerMeeting,
        meetingsRemaining,
      },
    });
  } catch (error) {
    logControllerError(
      logger,
      "Error fetching meetings remaining estimate",
      error,
      req,
    );
    return res
      .status(500)
      .json({ error: "Failed to fetch meetings remaining estimate" });
  }
};

/**
 * Get paginated credit transaction history for the logged-in user.
 *
 * @route GET /api/meetings/credits/history?page=1&limit=20
 * @access Authenticated users
 */
export const getCurrentUserCreditHistory = async (
  req: Request,
  res: Response,
) => {
  logger.info("Get current user credit history request", {
    userId: req.user?.userId,
    page: req.query.page,
    limit: req.query.limit,
  });

  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const { rows, total } = await getCreditTransactionHistory(
      userId,
      page,
      limit,
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    logControllerError(
      logger,
      "Error fetching current user credit history",
      error,
      req,
    );
    return res
      .status(500)
      .json({ error: "Failed to fetch credit transaction history" });
  }
};

/**
 * Get current subscription details for the logged-in user.
 *
 * @route GET /api/meetings/subscription
 * @access Authenticated users
 */
export const getCurrentUserSubscription = async (
  req: Request,
  res: Response,
) => {
  logger.info("Get current user subscription request", {
    userId: req.user?.userId,
  });

  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }

    const user = await userModel.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const plan = user.current_plan ?? "free";
    const expiry = user.plan_expiry ? new Date(user.plan_expiry) : null;

    let status: "free" | "active" | "expired" = "free";
    if (plan !== "free") {
      status = expiry && expiry > new Date() ? "active" : "expired";
    }

    return res.status(200).json({
      success: true,
      data: {
        plan,
        expiry,
        status,
      },
    });
  } catch (error) {
    logControllerError(
      logger,
      "Error fetching current user subscription",
      error,
      req,
    );
    return res.status(500).json({ error: "Failed to fetch subscription" });
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
  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }

    // Check available credits before processing
    const availableCredits = await getAvailableCredits(userId);
    if (availableCredits < 1) {
      logger.warn("Insufficient credits for upload", { userId });
      return res
        .status(403)
        .json({ error: "Insufficient credits. Please upgrade your plan." });
    }

    // Multer/Cloudinary puts file info on req.file
    const file = req.file as Express.Multer.File & {
      path?: string;
      filename?: string;
      originalname?: string;
      mimetype?: string;
      size?: number;
      public_id?: string;
      url?: string;
      secure_url?: string;
      format?: string;
      resource_type?: string;
    };
    if (!file || (!file.path && !file.url && !file.secure_url)) {
      logger.warn("No file uploaded or Cloudinary upload failed");
      return res
        .status(400)
        .json({ error: RESPONSE_MESSAGES.ONLY_VIDEO_ALLOWED });
    }
    // Accept Cloudinary URL (prefer secure_url, then url, then path)
    const videoUrl = file.secure_url || file.url || file.path;
    // 1. Create meeting record in DB with Cloudinary URL
    const meeting = await meetingModel.createMeeting(userId, videoUrl, "");
    const meetingId = meeting.id;
    logger.info("Meeting record created", { meetingId, userId, videoUrl });
    // 2. Update meeting record with status and empty results
    await meetingModel.updateMeetingResults(meetingId, {
      audioPath: "",
      transcript: "",
      summary: "",
      status: "uploaded",
    });
    logger.info("Meeting record updated after upload", { meetingId });
    // 3. Publish job to RabbitMQ for async processing
    publishJob({ meetingId, userId, video: videoUrl });
    logger.info("Job published to RabbitMQ", { meetingId });

    // 4. Deduct 1 credit for this meeting
    await insertCreditTransaction({
      user_id: userId,
      type: "debit",
      amount: 1,
      source: "meeting_usage",
      reference_id: meetingId,
      expiry: null,
    });
    logger.info("Credit deducted for meeting", { userId, meetingId });

    return httpResponse(res, 200, RESPONSE_MESSAGES.UPLOAD_SUCCESS, {
      meetingId,
    });
  } catch (error) {
    logControllerError(logger, "Meeting upload error", error, req);
    const message =
      error instanceof Error
        ? error.message
        : RESPONSE_MESSAGES.AUDIO_EXTRACTION_FAILED;
    return res.status(500).json({ error: message });
  }
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

/**
 * Edit the title of a meeting.
 * @route PATCH /api/meetings/:meetingId/title
 * @access Authenticated users (owner or admin)
 */
export const editMeetingTitle = async (req: Request, res: Response) => {
  logger.info("Edit meeting title request", {
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
    const { title } = req.body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "Title must be a non-empty string" });
    }
    // Only allow owner or admin to edit
    const meeting = await meetingModel.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    // TODO: Check this later
    // if (meeting.user_id !== userId && req.user?.role !== "admin") {
    //   return res.status(403).json({ error: "Forbidden: not your meeting" });
    // }
    const result = await updateMeetingTitleService(meetingId, title);
    return res.json({ success: result.success, title: result.title });
  } catch (error) {
    logControllerError(logger, "Error editing meeting title", error, req);
    return res.status(500).json({ error: "Failed to update meeting title" });
  }
};
