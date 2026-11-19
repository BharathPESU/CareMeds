import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildAssistantSystemPrompt, checkAssistantGuardrails } from '@/lib/assistant/guardrails';
import { requireApiAuth } from '@/lib/auth/session';
import { loadStore, persistStore } from '@/lib/store/repository';
import { assistantQuerySchema } from '@/lib/validation/schemas';

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured in server secrets. Configure it in Settings > Secrets to use the Care Assistant.' },
      { status: 503 }
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Strictly transmit ONLY the user's role and sanitized question text (zero resident data)
  let answerText: string;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: parsed.data.message,
      config: {
        systemInstruction: buildAssistantSystemPrompt(auth.ctx.user.role),
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });
    answerText =
      response.text?.trim() ||
      'No response generated. Please rephrase your general question.\n\nGeneral information only — always follow the written prescription and facility policy.';
  } catch (err) {
    console.error('Care Assistant API error:', (err as Error).message);
    return NextResponse.json(
      { error: 'Care Assistant could not reach the language model right now. Please try again shortly.' },
      { status: 502 }
    );
  }

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
  });
}
