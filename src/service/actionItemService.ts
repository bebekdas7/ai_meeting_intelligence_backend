import OpenAI from "openai";
import { ActionItem } from "../model/actionItemModel";
import { logger } from "../util/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Helper: split long transcript into chunks ---
function chunkText(text: string, maxLength: number = 12000): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLength));
    start += maxLength;
  }

  return chunks;
}

// --- Helper: normalize + deduplicate ---
function normalizeItems(items: ActionItem[]): ActionItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.task.toLowerCase().trim();

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
}

export async function extractActionItems(
  transcript: string,
): Promise<ActionItem[]> {
  logger.info("Extracting action items from transcript");

  console.log("Full transcript for action item extraction:", transcript);
  const chunks = chunkText(transcript);
  const allItems: ActionItem[] = [];

  for (const chunk of chunks) {
    const prompt = `
Extract actionable tasks from the following meeting transcript.

Return strictly this JSON format:
{
  "action_items": [
    {
      "task": "clear actionable task",
      "assignee": "person responsible or null"
    }
  ]
}

Strict Rules:
- Only extract REAL tasks someone must do
- Ignore discussions, questions, suggestions, or past/completed actions
- Capture implied tasks (e.g., "I'll send it tomorrow" → task)
- Do NOT hallucinate names
- If assignee is unclear, return null
- Keep tasks short, specific, and executable
- Avoid duplicates

Transcript:
${chunk}
`;

    try {
      console.log("Sending prompt to LLM for action item extraction:", prompt);
      const response = await openai.chat.completions.create({
        model: "gpt-4.1", // better for long reasoning
        messages: [
          {
            role: "system",
            content: `
You are an expert meeting assistant extracting precise action items from noisy transcripts.

You must:
- Detect implicit and explicit tasks
- Ignore filler conversation
- Output strictly valid JSON
`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      });
      console.log("LLM response for action item extraction:", response);

      const content = response.choices?.[0]?.message?.content;

      logger.info("Raw LLM action item response", { content });
      console.log("Raw LLM action item response:", content);

      if (!content) {
        logger.warn("No content returned from LLM for a chunk.");
        continue;
      }

      try {
        const parsed = JSON.parse(content);

        // Accept both array and object with action_items
        let items: any[] = [];
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (Array.isArray(parsed.action_items)) {
          items = parsed.action_items;
        } else if (parsed.items && Array.isArray(parsed.items)) {
          items = parsed.items;
        }

        const validItems: ActionItem[] = items
          .filter(
            (item: any) =>
              item &&
              typeof item.task === "string" &&
              item.task.trim().length > 0 &&
              "assignee" in item,
          )
          .map((item: any) => ({
            task: item.task.trim(),
            assignee:
              typeof item.assignee === "string" &&
              item.assignee.trim().length > 0
                ? item.assignee.trim()
                : null,
          }));

        allItems.push(...validItems);
      } catch (err) {
        logger.error("Failed to parse action items from chunk", {
          err,
          content,
        });
      }
    } catch (err) {
      logger.error("OpenAI API call failed for chunk", { err });
    }
  }

  // Final cleanup
  return normalizeItems(allItems);
}
