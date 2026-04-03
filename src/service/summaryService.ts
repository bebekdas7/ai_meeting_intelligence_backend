import { logger } from "../util/logger";

/**
 * Generates a concise summary for a meeting transcript using OpenAI GPT.
 * Falls back to slicing if OpenAI fails.
 * @param transcript The full meeting transcript
 * @param meetingId The meeting ID (for logging)
 * @param apiKey OpenAI API key
 * @returns {Promise<string>} The generated summary
 */
export async function generateMeetingSummary(
  transcript: string,
  meetingId: string,
  apiKey: string,
): Promise<string> {
  let summary = "";
  try {
    const openai = require("openai");
    const openaiClient = new openai.OpenAI({
      apiKey,
    });
    const summaryPrompt = `Summarize the following meeting transcript.\n\n- If the transcript is short, provide a concise paragraph.\n- If it is long, provide a detailed summary with bullet points, covering all main topics, decisions, and action items.\n- Be clear and comprehensive.\n\nTranscript:\n${transcript.slice(0, 6000)}`;
    const summaryCompletion = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes meeting transcripts.",
        },
        { role: "user", content: summaryPrompt },
      ],
      max_tokens: 400,
      temperature: 0.5,
    });
    summary = summaryCompletion.choices[0]?.message?.content?.trim() || "";
    logger.info("[SummaryService] Summary generated", { meetingId });
  } catch (err) {
    logger.error("[SummaryService] Failed to generate summary", {
      meetingId,
      err,
    });
    // fallback to old slicing method
    summary = transcript.slice(0, 200) + (transcript.length > 200 ? "..." : "");
  }
  return summary;
}
