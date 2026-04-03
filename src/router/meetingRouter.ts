import { Router } from "express";
import multer from "multer";
import { videoStorage } from "../config/cloudinaryMulter";
import { getUserMeetingDashboard } from "../controller/meetingController";
import {
  uploadMeetingVideo,
  getMeetingsForUser,
  retryMeetingProcessing,
  getMostRecentMeetingForUser,
  getMeetingById,
  editMeetingTitle,
} from "../controller/meetingController";
import { authenticate } from "../middleware/authMiddleware";
import { authorize } from "../middleware/authorizeMiddleware";
import rateLimit from "express-rate-limit";

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: "Too many uploads, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const meetingRouter = Router();
const upload = multer({ storage: videoStorage });

// Get the most recent meeting for the logged-in user
meetingRouter.get("/recent", authenticate, getMostRecentMeetingForUser);

// User dashboard stats endpoint
meetingRouter.get("/dashboard", authenticate, getUserMeetingDashboard);

// Video upload route
meetingRouter.post(
  "/upload",
  uploadLimiter,
  authenticate,
  authorize("user", "admin"),
  upload.single("file"),
  (_req, _res, next) => {
    console.log("before multer upload.single");
    next();
  },
  uploadMeetingVideo,
);

// Manual retry for failed meeting processing
meetingRouter.post(
  "/:meetingId/retry",
  authenticate,
  authorize("user", "admin"),
  retryMeetingProcessing,
);

// Get all meetings for the logged-in user
meetingRouter.get("/my-meetings", authenticate, getMeetingsForUser);

// Get meeting details by meeting ID
meetingRouter.get("/:meetingId", authenticate, getMeetingById);

// User dashboard stats endpoint (must be after all other specific routes)
meetingRouter.get("/dashboard", authenticate, getUserMeetingDashboard);

// Edit meeting title
meetingRouter.patch(
  "/:meetingId/title",
  authenticate,
  authorize("user", "admin"),
  editMeetingTitle,
);

export default meetingRouter;
