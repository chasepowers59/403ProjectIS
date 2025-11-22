const OpenAI = require('openai');

/**
 * AI Event Extractor Service
 * Uses OpenAI to extract structured event data from Slack messages
 */

// Initialize OpenAI client
// Expects OPENAI_API_KEY to be set in environment variables
let openai;
try {
    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    } else {
        console.warn('[AIEventExtractor] OPENAI_API_KEY not found. AI features will be disabled.');
    }
} catch (error) {
    console.warn('[AIEventExtractor] Failed to initialize OpenAI client:', error.message);
}

const aiEventExtractor = {
    openai: openai,
    /**
     * Extract events from a list of normalized Slack messages
     * @param {Array} messages - Array of normalized message objects
     * @returns {Promise<Array>} Array of extracted event objects
     */
    extractEvents: async (messages) => {
        // 1. Validate input
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return [];
        }

        // 2. Batch processing (max 200 messages per batch)
        const BATCH_SIZE = 200;
        const allEvents = [];

        // Helper to process a single batch
        const processBatch = async (batchMessages) => {
            // Construct the prompt
            const systemPrompt = `
You are an intelligent assistant that extracts event information from Slack messages.
Your goal is to identify actionable events such as meetings, deadlines, exams, and announcements.
Ignore purely social chatter, spam, or irrelevant messages.

Input: A JSON array of Slack messages.
Output: A JSON object with a single key "events" containing an array of event objects.
Schema:
{
  "events": [
    {
      "title": "Brief title of the event",
      "date": "YYYY-MM-DD (inferred from context or message timestamp)",
      "start_time": "HH:MM (24-hour format, optional)",
      "end_time": "HH:MM (24-hour format, optional)",
      "description": "Brief description or context",
      "source_channel": "The channel name from the message",
      "raw_message_id": "The unique ID of the message (ts + user) if available"
    }
  ]
}

Rules:
- Use the message timestamp as a reference for relative dates (e.g., "tomorrow").
- If no specific time is mentioned, omit start_time/end_time.
- Return {"events": []} if no events are found.
- Output ONLY valid JSON.
`;

            // Prepare user content
            const userContent = JSON.stringify(batchMessages.map(m => ({
                ts: m.msg_timestamp,
                user: m.user,
                channel: m.channel,
                text: m.text,
                // Create a composite ID to track back to the original message
                id: `${m.msg_timestamp}_${m.user}`
            })));

            try {
                if (!openai) {
                    console.error('[AIEventExtractor] OpenAI client not initialized (missing API key).');
                    return [];
                }

                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userContent }
                    ],
                    temperature: 0,
                    response_format: { type: "json_object" }
                });

                const content = completion.choices[0].message.content;
                console.log('[AIEventExtractor] Batch response length:', content.length);

                let parsed;
                try {
                    parsed = JSON.parse(content);
                } catch (e) {
                    console.error('[AIEventExtractor] Failed to parse JSON response:', content);
                    return [];
                }

                if (parsed.events && Array.isArray(parsed.events)) {
                    return parsed.events;
                } else {
                    console.warn('[AIEventExtractor] Unexpected JSON structure in batch response:', parsed);
                    return [];
                }
            } catch (error) {
                console.error('[AIEventExtractor] Batch processing error:', error.message);
                return [];
            }
        };

        // Process all batches
        console.log(`[AIEventExtractor] Processing ${messages.length} messages in batches of ${BATCH_SIZE}...`);

        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
            const batch = messages.slice(i, i + BATCH_SIZE);
            console.log(`[AIEventExtractor] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(messages.length / BATCH_SIZE)}`);

            const batchEvents = await processBatch(batch);
            allEvents.push(...batchEvents);
        }

        console.log(`[AIEventExtractor] Total extracted events: ${allEvents.length}`);
        return allEvents;
    }
};

module.exports = aiEventExtractor;
