import { Router } from "express";
import {
  getActionItemsByMeeting,
  getActionItemsByAssignee,
  getActionItemsForUserMeetings,
  updateActionItem,
  createActionItem,
  deleteActionItem,
} from "../controller/actionItemController";
import { validate } from "../middleware/validate";
import {
  createActionItemSchema,
  updateActionItemSchema,
} from "../util/validators";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

// Get all action items for a meeting
router.get("/meetings/:id/action-items", getActionItemsByMeeting);
// Get all action items for an assignee
router.get("/action-items", getActionItemsByAssignee);
// Update an action item (PATCH)
router.patch(
  "/action-items/:id",
  validate(updateActionItemSchema),
  updateActionItem,
);
// Create an action item (POST)
router.post(
  "/action-items",
  validate(createActionItemSchema),
  createActionItem,
);
// (Optional) Delete an action item
router.delete("/action-items/:id", deleteActionItem);
// Get all action items for the current user's meetings
router.get("/user-meetings", authenticate, getActionItemsForUserMeetings);

export default router;
