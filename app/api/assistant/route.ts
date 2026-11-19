import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildAssistantSystemPrompt, checkAssistantGuardrails } from '@/lib/assistant/guardrails';
import { requireApiAuth } from '@/lib/auth/session';
import { loadStore, persistStore } from '@/lib/store/repository';
import { assistantQuerySchema } from '@/lib/validation/schemas';

// Maintain a module-level round-robin pointer across requests
const globalState = globalThis as unknown as { __geminiKeyIndex?: number };
if (typeof globalState.__geminiKeyIndex !== 'number') {
  globalState.__geminiKeyIndex = 0;
}

function getCandidateGeminiKeys(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY1,
    process.env.GEMINI_API_KEY2,
    process.env.GEMINI_API_KEY3,
    process.env.GEMINI_API_KEY4,
    process.env.GEMINI_API_KEY,
  ];

  const unique: string[] = [];
  for (const k of candidates) {
    if (k && typeof k === 'string') {
      const trimmed = k.trim();
      if (trimmed && !trimmed.includes('MY_GEMINI') && !unique.includes(trimmed)) {
        unique.push(trimmed);
      }
    }
  }
  return unique;
}

function enforceCharLimit(text: string, limit = 600): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const slice = trimmed.slice(0, limit - 3);
  const lastSpace = slice.lastIndexOf(' ');
  const boundary = lastSpace > limit - 100 ? slice.slice(0, lastSpace) : slice;
  return `${boundary.trim()}...`;
}

export async function GET() {
  const auth = await requireApiAuth('assistant.use');
  if (!auth.ok) return auth.response;

  const store = loadStore();
  const conversations = store.assistantConversations
    .filter((c) => c.userId === auth.ctx.user.userId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const convIds = new Set(conversations.map((c) => c.conversationId));
  const messages = store.assistantMessages
    .filter((m) => convIds.has(m.conversationId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return NextResponse.json({ conversations, messages });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth('assistant.use');
  if (!auth.ok) return auth.response;

  const parsed = assistantQuerySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Enter a valid question' },
      { status: 400 }
    );
  }

  const store = loadStore();
  const residentNames = store.residents.map((r) => r.fullName);
  const guardrail = checkAssistantGuardrails(parsed.data.message, residentNames);

  if (!guardrail.allowed) {
    return NextResponse.json({ error: guardrail.reason, blockedByGuardrail: true }, { status: 400 });
  }

  const apiKeys = getCandidateGeminiKeys();
  if (apiKeys.length === 0) {
    return NextResponse.json(
      {
        error:
          'No valid GEMINI_API_KEY configured in server secrets. Add GEMINI_API_KEY or GEMINI_API_KEY1..4 to use the Care Assistant.',
      },
      { status: 503 }
    );
  }

  // Round-robin selection starting point
  const totalKeys = apiKeys.length;
  const startIndex = (globalState.__geminiKeyIndex ?? 0) % totalKeys;
  globalState.__geminiKeyIndex = (startIndex + 1) % totalKeys;

  let rawAnswer = '';
  let usedKeyIndex = startIndex;
  let lastError: Error | null = null;
  const systemPrompt = buildAssistantSystemPrompt(auth.ctx.user.role);

  // Failover loop: rotate through keys starting from startIndex until one succeeds
  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const keyIndex = (startIndex + attempt) % totalKeys;
    const currentKey = apiKeys[keyIndex];

    try {
      const ai = new GoogleGenAI({
        apiKey: currentKey,
        httpOptions: {
          apiVersion: 'v1beta',
          timeout: 10000,
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      // Try gemini-2.5-flash; fallback to gemini-3.8-flash if model deprecated for that key
      let response: { text?: string } | null = null;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: parsed.data.message,
          config: {
            systemInstruction: systemPrompt,
          },
        });
      } catch (err: unknown) {
        const msg = (err as Error)?.message || '';
        if (msg.includes('gemini-2.5-flash') && (msg.includes('not found') || msg.includes('no longer available') || msg.includes('404'))) {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: parsed.data.message,
            config: {
              systemInstruction: systemPrompt,
            },
          });
        } else {
          throw err;
        }
      }

      if (response?.text?.trim()) {
        rawAnswer = response.text.trim();
        usedKeyIndex = keyIndex;
        break; // Successfully got an answer!
      }
    } catch (err: unknown) {
      lastError = err as Error;
      console.warn(`[Care Assistant] Key index ${keyIndex} attempt failed:`, (err as Error).message);
    }
  }

  if (!rawAnswer) {
    console.error('[Care Assistant] All Gemini API keys failed in failover:', lastError?.message);
    return NextResponse.json(
      {
        error:
          'Care Assistant could not reach the language model right now. Please try again shortly.',
      },
      { status: 502 }
    );
  }

  // Strictly enforce <= 600 characters limit
  const answerText = enforceCharLimit(rawAnswer, 600);

  const nowIso = new Date().toISOString();
  let conversationId = parsed.data.conversationId;
  if (
    !conversationId ||
    !store.assistantConversations.some(
      (c) => c.conversationId === conversationId && c.userId === auth.ctx.user.userId
    )
  ) {
    conversationId = randomUUID();
    store.assistantConversations.unshift({
      conversationId,
      userId: auth.ctx.user.userId,
      startedAt: nowIso,
      title: parsed.data.message.slice(0, 64),
    });
  }

  const userMsg = {
    messageId: randomUUID(),
    conversationId,
    sender: 'User' as const,
    content: parsed.data.message,
    createdAt: nowIso,
  };
  const assistantMsg = {
    messageId: randomUUID(),
    conversationId,
    sender: 'Assistant' as const,
    content: answerText,
    createdAt: new Date(Date.now() + 10).toISOString(),
  };

  store.assistantMessages.push(userMsg, assistantMsg);
  persistStore(store);

  return NextResponse.json({
    conversationId,
    warning: guardrail.warning || null,
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    charCount: answerText.length,
    keyRotated: usedKeyIndex + 1,
  });
}
