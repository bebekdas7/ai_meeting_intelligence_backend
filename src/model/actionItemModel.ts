import pool from "../db/db";

export interface ActionItem {
  task: string;
  assignee: string | null;
}

async function bulkInsertActionItems(meetingId: string, items: ActionItem[]) {
  if (!items.length) return;
  const values: any[] = [];
  const placeholders: string[] = [];
  items.forEach((item, idx) => {
    const i = idx * 4;
    placeholders.push(`($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4})`);
    values.push(meetingId, item.task, item.assignee || null, "pending");
  });
  const query = `INSERT INTO action_items (meeting_id, task, assignee, status) VALUES ${placeholders.join(",")}`;
  await pool.query(query, values);
}

async function getActionItemsByMeetingIds(meetingIds: string[]) {
  if (!meetingIds.length) return [];
  const placeholders = meetingIds.map((_, i) => `$${i + 1}`).join(",");
  const query = `SELECT * FROM action_items WHERE meeting_id IN (${placeholders})`;
  const result = await pool.query(query, meetingIds);
  return result.rows;
}

async function deleteByMeetingId(meetingId: string) {
  await pool.query(`DELETE FROM action_items WHERE meeting_id = $1`, [
    meetingId,
  ]);
}

async function getActionItemsByMeetingId(meetingId: string) {
  const result = await pool.query(
    `SELECT * FROM action_items WHERE meeting_id = $1`,
    [meetingId],
  );
  return result.rows;
}

async function getActionItemsByAssignee(assignee: string) {
  const result = await pool.query(
    `SELECT * FROM action_items WHERE assignee = $1`,
    [assignee],
  );
  return result.rows;
}

async function updateActionItem(
  id: string,
  fields: { status?: string; assignee?: string },
) {
  const updates = [];
  const values: any[] = [];
  let idx = 1;
  if (fields.status) {
    updates.push(`status = $${idx++}`);
    values.push(fields.status);
  }
  if (fields.assignee) {
    updates.push(`assignee = $${idx++}`);
    values.push(fields.assignee);
  }
  if (!updates.length) return;
  values.push(id);
  const query = `UPDATE action_items SET ${updates.join(", ")} WHERE id = $${idx}`;
  await pool.query(query, values);
}

async function createActionItem(
  meetingId: string,
  task: string,
  assignee: string | null,
) {
  const result = await pool.query(
    `INSERT INTO action_items (meeting_id, task, assignee, status) VALUES ($1, $2, $3, $4) RETURNING *`,
    [meetingId, task, assignee, "pending"],
  );
  return result.rows[0];
}

async function deleteActionItem(id: string) {
  await pool.query(`DELETE FROM action_items WHERE id = $1`, [id]);
}

export default {
  bulkInsertActionItems,
  deleteByMeetingId,
  getActionItemsByMeetingId,
  getActionItemsByAssignee,
  getActionItemsByMeetingIds,
  updateActionItem,
  createActionItem,
  deleteActionItem,
};
