import pool from "../db/db";

async function createMeeting(
  userId: string,
  videoPath: string,
  audioPath: string,
) {
  const result = await pool.query(
    `INSERT INTO meetings (user_id, video_path, audio_path, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
    [userId, videoPath, audioPath, "pending"],
  );

  return result.rows[0];
}

/**
 * Updates the title of a meeting and returns success and the updated title.
 * @param meetingId Meeting ID
 * @param title New title
 * @returns {Promise<{ success: boolean; title: string }>} Result
 */
async function updateMeetingTitle(
  meetingId: string,
  title: string,
): Promise<{ success: boolean; title: string }> {
  const result = await pool.query(
    `UPDATE meetings SET title = $1 WHERE id = $2 RETURNING title`,
    [title, meetingId],
  );
  return {
    success: (result.rowCount ?? 0) > 0,
    title: result.rows[0]?.title || "",
  };
}

async function getMeetingById(meetingId: string) {
  const result = await pool.query(`SELECT * FROM meetings WHERE id = $1`, [
    meetingId,
  ]);
  return result.rows[0];
}

interface GetMeetingByUserIdOptions {
  recent?: boolean | number;
}

async function getMeetingByUserId(
  userId: string,
  options?: GetMeetingByUserIdOptions,
) {
  if (options?.recent) {
    const limit = typeof options.recent === "number" ? options.recent : 1;
    const result = await pool.query(
      `SELECT * FROM meetings WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return result.rows;
  } else {
    const result = await pool.query(
      `SELECT * FROM meetings WHERE user_id = $1`,
      [userId],
    );
    return result.rows;
  }
}

async function updateMeetingResults(
  meetingId: string,
  {
    audioPath,
    transcript,
    summary,
    status,
  }: { audioPath: string; transcript: string; summary: string; status: string },
) {
  await pool.query(
    `UPDATE meetings SET audio_path = $1, transcript = $2, summary = $3, status = $4 WHERE id = $5`,
    [audioPath, transcript, summary, status, meetingId],
  );
}

async function updateMeetingVideoPath(meetingId: string, videoPath: string) {
  await pool.query(`UPDATE meetings SET video_path = $1 WHERE id = $2`, [
    videoPath,
    meetingId,
  ]);
}

async function updateMeetingVideoDuration(meetingId: string, duration: number) {
  await pool.query(`UPDATE meetings SET duration = $1 WHERE id = $2`, [
    duration,
    meetingId,
  ]);
}

async function updateMeetingResultsWithTitle(
  meetingId: string,
  {
    audioPath,
    transcript,
    summary,
    status,
    title,
  }: {
    audioPath: string;
    transcript: string;
    summary: string;
    status: string;
    title: string;
  },
) {
  await pool.query(
    `UPDATE meetings SET audio_path = $1, transcript = $2, summary = $3, status = $4, title = $5 WHERE id = $6`,
    [audioPath, transcript, summary, status, title, meetingId],
  );
}

export default {
  createMeeting,
  getMeetingById,
  getMeetingByUserId,
  updateMeetingResults,
  updateMeetingVideoPath,
  updateMeetingVideoDuration,
  updateMeetingResultsWithTitle,
  updateMeetingTitle,
};
