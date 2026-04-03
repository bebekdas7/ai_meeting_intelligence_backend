import meetingModel from "../model/meetingModel";
import { Request, Response } from "express";
import actionItemModel from "../model/actionItemModel";
import { logger, logControllerError } from "../util/logger";

// GET /action-items/user-meetings
export async function getActionItemsForUserMeetings(
  req: Request,
  res: Response,
) {
  logger.info("Get action items for current user's meetings", {
    userId: req.user?.userId,
  });
  try {
    const userId = req.user?.userId;
    if (!userId) {
      logger.warn("Unauthorized: userId missing");
      return res.status(401).json({ error: "Unauthorized: userId missing" });
    }
    const meetings = await meetingModel.getMeetingByUserId(userId);
    const meetingIds = meetings.map((m: any) => m.id);
    if (!meetingIds.length) {
      return res.json({ actionItems: [] });
    }
    const actionItems =
      await actionItemModel.getActionItemsByMeetingIds(meetingIds);
    logger.info("Fetched action items for user meetings", {
      userId,
      count: actionItems.length,
    });
    return res.json({ actionItems });
  } catch (error) {
    logControllerError(
      logger,
      "Error fetching action items for user meetings",
      error,
      req,
    );
    return res.status(500).json({ error: "Failed to fetch action items" });
  }
}

// GET /meetings/:id/action-items
export async function getActionItemsByMeeting(req: Request, res: Response) {
  logger.info("Get action items by meeting", { meetingId: req.params.id });
  const meetingIdParam = req.params.id;
  const meetingId = Array.isArray(meetingIdParam)
    ? meetingIdParam[0]
    : meetingIdParam;
  if (!meetingId) {
    logger.warn("Missing meetingId in request", { reqParams: req.params });
    return res.status(400).json({ error: "Missing meetingId" });
  }
  try {
    const actionItems =
      await actionItemModel.getActionItemsByMeetingId(meetingId);
    logger.info("Fetched action items for meeting", {
      meetingId,
      count: actionItems.length,
    });
    return res.json({ actionItems });
  } catch (error) {
    logControllerError(
      logger,
      "Error fetching action items by meeting",
      error,
      req,
    );
    return res.status(500).json({ error: "Failed to fetch action items" });
  }
}

// GET /action-items?assignee=John
export async function getActionItemsByAssignee(req: Request, res: Response) {
  logger.info("Get action items by assignee", { assignee: req.query.assignee });
  const assigneeParam = req.query.assignee;
  const assignee = Array.isArray(assigneeParam)
    ? assigneeParam[0]
    : assigneeParam;
  if (!assignee) {
    logger.warn("Missing assignee in request", { reqQuery: req.query });
    return res.status(400).json({ error: "Missing assignee" });
  }
  try {
    const actionItems = await actionItemModel.getActionItemsByAssignee(
      String(assignee),
    );
    logger.info("Fetched action items for assignee", {
      assignee,
      count: actionItems.length,
    });
    return res.json({ actionItems });
  } catch (error) {
    logControllerError(
      logger,
      "Error fetching action items by assignee",
      error,
      req,
    );
    return res.status(500).json({ error: "Failed to fetch action items" });
  }
}

// PATCH /action-items/:id
export async function updateActionItem(req: Request, res: Response) {
  // Only log non-sensitive fields
  const filteredBody = require("../util/logger").filterSensitive(req.body);
  logger.info("Update action item", { id: req.params.id, body: filteredBody });
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    logger.warn("Missing id in update request");
    return res.status(400).json({ error: "Missing id" });
  }
  const { status, assignee } = req.body;
  if (!status && !assignee) {
    logger.warn("Nothing to update in action item", { id });
    return res.status(400).json({ error: "Nothing to update" });
  }
  try {
    await actionItemModel.updateActionItem(id, { status, assignee });
    logger.info("Action item updated", { id, status, assignee });
    return res.json({ success: true });
  } catch (error) {
    logControllerError(logger, "Error updating action item", error, req);
    return res.status(500).json({ error: "Failed to update action item" });
  }
}

// (Optional) POST /action-items
export async function createActionItem(req: Request, res: Response) {
  // Only log non-sensitive fields
  const filteredBody = require("../util/logger").filterSensitive(req.body);
  logger.info("Create action item", { body: filteredBody });
  const { meetingId, task, assignee } = req.body;
  if (!meetingId || !task) {
    logger.warn("Missing meetingId or task in create request");
    return res.status(400).json({ error: "Missing meetingId or task" });
  }
  try {
    const actionItem = await actionItemModel.createActionItem(
      meetingId,
      task,
      assignee || null,
    );
    logger.info("Action item created", { meetingId, task, assignee });
    return res.status(201).json({ actionItem });
  } catch (error) {
    logControllerError(logger, "Error creating action item", error, req);
    return res.status(500).json({ error: "Failed to create action item" });
  }
}

// (Optional) DELETE /action-items/:id
export async function deleteActionItem(req: Request, res: Response) {
  logger.info("Delete action item", { id: req.params.id });
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    logger.warn("Missing id in delete request");
    return res.status(400).json({ error: "Missing id" });
  }
  try {
    await actionItemModel.deleteActionItem(id);
    logger.info("Action item deleted", { id });
    return res.json({ success: true });
  } catch (error) {
    logControllerError(logger, "Error deleting action item", error, req);
    return res.status(500).json({ error: "Failed to delete action item" });
  }
}
