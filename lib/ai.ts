/**
 * leteski AI client — supports direct Google Gemini API and proxy fallback.
 * Includes automatic retry with exponential backoff for 429/503 rate limits.
 */

const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  'AQ.Ab8RN6JPG7vihKPh9RZFRt3bA5q8FO0Ob3nWxrfq7NaHaJLfXw';

const TOOLKIT_URL = process.env.EXPO_PUBLIC_TOOLKIT_URL;
const TOOLKIT_SECRET = process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY;

// Ordered list of models to try — if one is overloaded, fall back to the next
const MODEL_IDS = [
  'gemini-3.5-flash',       // fast, newest flash
  'gemini-3.5-flash-lite',  // lighter variant
  'gemini-flash-lite-latest', // lightweight fallback
  'gemini-3.7-flash',       // newest generation fallback
];

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2s, 4s, 8s

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

/** Sleep helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Returns true if the error is a retryable rate-limit or overload */
function isRetryable(status: number): boolean {
  return status === 429 || status === 503;
}

/**
 * Build request body for Gemini generateContent / streamGenerateContent
 */
function buildGeminiBody(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
) {
  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const contents = chatMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: any = {
    contents,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 800,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  };

  if (systemMsg) {
    body.systemInstruction = {
      parts: [{ text: systemMsg.content }],
    };
  }

  return body;
}

/**
 * Direct call to Google Gemini REST API with retry + model fallback.
 */
async function callGeminiDirect(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const body = buildGeminiBody(messages, options);
  let lastError: Error | null = null;

  for (const modelId of MODEL_IDS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (isRetryable(res.status) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[AI] ${modelId} returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          await sleep(delay);
          continue;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const errMsg = errData?.error?.message || `HTTP ${res.status}`;
          // If 429/503 on last retry, fall through to next model
          if (isRetryable(res.status)) {
            console.warn(`[AI] ${modelId} exhausted retries with ${res.status}, trying next model...`);
            lastError = new Error(errMsg);
            break; // break retry loop, move to next model
          }
          throw new Error(errMsg);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || '';
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES && !err.message?.includes('HTTP')) {
          // Network error — retry
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[AI] ${modelId} error: ${err.message}, retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models unavailable.');
}

/**
 * Send a chat completion request and return the full response.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  let directError: any = null;

  if (GEMINI_API_KEY) {
    try {
      return await callGeminiDirect(messages, options);
    } catch (err: any) {
      directError = err;
      console.warn('[AI] Direct Gemini API call failed:', err?.message || err);
    }
  }

  // Fallback to proxy if configured
  if (TOOLKIT_URL) {
    try {
      const CHAT_ENDPOINT = `${TOOLKIT_URL}/v2/vercel/v1/chat/completions`;
      const body = {
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 800,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (TOOLKIT_SECRET) {
        headers['Authorization'] = `Bearer ${TOOLKIT_SECRET}`;
      }

      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        return data?.choices?.[0]?.message?.content ?? '';
      }
    } catch (proxyErr) {
      console.warn('[AI] Proxy call failed:', proxyErr);
    }
  }

  throw directError || new Error('AI service is currently unavailable.');
}

/**
 * Stream a chat completion with retry + model fallback.
 * Calls onChunk for each token delta.
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  options?: { temperature?: number; maxTokens?: number }
): Promise<void> {
  let directError: any = null;

  if (GEMINI_API_KEY) {
    const body = buildGeminiBody(messages, options);

    for (const modelId of MODEL_IDS) {
      let succeeded = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (isRetryable(res.status) && attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(`[AI] Stream ${modelId} returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
            await sleep(delay);
            continue;
          }

          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            const errMsg = errData?.error?.message || `HTTP ${res.status}`;
            if (isRetryable(res.status)) {
              console.warn(`[AI] Stream ${modelId} exhausted retries, trying next model...`);
              directError = new Error(errMsg);
              break; // next model
            }
            throw new Error(errMsg);
          }

          if (res.body && typeof (res.body as any).getReader === 'function') {
            const reader = (res.body as any).getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const payload = trimmed.slice(6);
                if (payload === '[DONE]') return;
                try {
                  const parsed = JSON.parse(payload);
                  const delta = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (delta) onChunk(delta);
                } catch {
                  // skip malformed chunks
                }
              }
            }
            return; // stream consumed successfully
          } else {
            // Fallback: no ReadableStream reader — simulate streaming from non-stream response
            const fullText = await callGeminiDirect(messages, options);
            if (fullText) {
              const words = fullText.split(' ');
              for (let i = 0; i < words.length; i++) {
                onChunk(words[i] + (i < words.length - 1 ? ' ' : ''));
                await sleep(25);
              }
              return;
            }
          }

          succeeded = true;
          break;
        } catch (err: any) {
          directError = err;
          if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            console.warn(`[AI] Stream ${modelId} error: ${err.message}, retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
        }
      }

      if (succeeded) return;
    }

    if (directError) {
      console.warn('[AI] All Gemini stream models exhausted:', directError?.message);
    }
  }

  // Fallback to proxy
  if (TOOLKIT_URL) {
    try {
      const CHAT_ENDPOINT = `${TOOLKIT_URL}/v2/vercel/v1/chat/completions`;
      const body = {
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 800,
        stream: true,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (TOOLKIT_SECRET) {
        headers['Authorization'] = `Bearer ${TOOLKIT_SECRET}`;
      }

      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok && res.body && typeof (res.body as any).getReader === 'function') {
        const reader = (res.body as any).getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') return;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (delta) onChunk(delta);
            } catch {
              // skip
            }
          }
        }
        return;
      }
    } catch (proxyErr) {
      console.warn('[AI] Proxy stream failed:', proxyErr);
    }
  }

  throw directError || new Error('AI streaming service unavailable.');
}

/**
 * Generate a compelling skill description for teachers (strictly under 300 characters).
 */
export async function generateSkillDescription(
  skillTitle: string,
  category: string,
  level: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a helpful assistant for leteski, a skill-exchange platform. Write concise, compelling skill descriptions for teachers. STRICT REQUIREMENT: The description MUST be under 280 characters in total (around 2 short punchy sentences). Do NOT use markdown, emojis, or headers.',
    },
    {
      role: 'user',
      content: `Write a short skill description (MAX 280 characters):\nTitle: ${skillTitle}\nCategory: ${category}\nLevel: ${level}\n\nHighlight what students will learn and what makes this class great in under 280 chars.`,
    },
  ];
  const result = await chatCompletion(messages, { temperature: 0.7, maxTokens: 150 });
  const trimmed = result.trim();
  if (trimmed.length > 300) {
    const periodIdx = trimmed.slice(0, 300).lastIndexOf('.');
    if (periodIdx > 100) {
      return trimmed.slice(0, periodIdx + 1).trim();
    }
    return trimmed.slice(0, 297).trim() + '...';
  }
  return trimmed;
}

/**
 * Generate a compelling class description for teachers (concise and under 500 characters).
 */
export async function generateClassDescription(
  title: string,
  category: string,
  level: string,
  sessionType: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a helpful assistant for leteski, a skill-exchange platform. Write compelling, concise class descriptions. Keep it 2-3 sentences (MAX 450 characters), informative and exciting. Do not use markdown, emojis, or headers.',
    },
    {
      role: 'user',
      content: `Write a class description (under 450 characters):\nTitle: ${title}\nCategory: ${category}\nLevel: ${level}\nSession type: ${sessionType}\n\nDescribe what students will learn and why they should join.`,
    },
  ];
  const result = await chatCompletion(messages, { temperature: 0.7, maxTokens: 250 });
  const trimmed = result.trim();
  if (trimmed.length > 500) {
    const periodIdx = trimmed.slice(0, 500).lastIndexOf('.');
    if (periodIdx > 200) {
      return trimmed.slice(0, periodIdx + 1).trim();
    }
    return trimmed.slice(0, 497).trim() + '...';
  }
  return trimmed;
}

/**
 * Generate a match insight explaining why two users are a good match.
 */
export async function generateMatchInsight(
  userName: string,
  userSkills: string[],
  matchName: string,
  matchSkills: string[],
  youCanLearn: string[],
  theyCanLearn: string[]
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a friendly matchmaker assistant for leteski, a skill-exchange platform. Explain why two people are a great match in 1-2 short sentences. Be warm, specific, and encouraging. Do not use markdown.',
    },
    {
      role: 'user',
      content: `${userName} offers: ${userSkills.join(', ') || 'N/A'}\n${matchName} offers: ${matchSkills.join(', ') || 'N/A'}\n${userName} can learn from ${matchName}: ${youCanLearn.join(', ') || 'N/A'}\n${matchName} can learn from ${userName}: ${theyCanLearn.join(', ') || 'N/A'}\n\nExplain why this is a great match in 1-2 sentences.`,
    },
  ];
  const result = await chatCompletion(messages, { temperature: 0.7, maxTokens: 500 });
  return result.trim();
}
