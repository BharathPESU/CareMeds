'use client';

import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { AlertCircle, Bot, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';

interface AssistantMsg {
  messageId: string;
  conversationId: string;
  sender: 'User' | 'Assistant';
  content: string;
  createdAt: string;
}

const ROLE_PROMPTS: Record<string, string[]> = {
  Caretaker: [
    'What are general storage guidelines for insulin pens in a residential care home?',
    'What is the general purpose of taking Metformin with food?',
    'How should caretakers document a refused oral tablet dose?',
  ],
  Doctor: [
    'Summarize common geriatric monitoring considerations for ACE inhibitors.',
    'What are typical drug-class side effects to review with loop diuretics in elderly adults?',
    'Explain FEFO stock rotation best practices for multi-dose facility pharmacies.',
  ],
  Admin: [
    'What is the recommended temperature range for a residential care medicine refrigerator?',
    'Explain best practices for dual-control verification of controlled drug disposals.',
    'What should a facility medication audit checklist cover monthly?',
  ],
};

export default function AssistantPage() {
  const { user, csrfToken } = useAuth();
  const [messages, setMessages] = useState<AssistantMsg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [guardrailError, setGuardrailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/assistant', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!active || !d) return;
        setMessages(d.messages || []);
        if (d.conversations?.[0]) {
          setConversationId(d.conversations[0].conversationId);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setGuardrailError(null);
    setSending(true);
    try {
      const { ok, data } = await apiFetch<{
        conversationId?: string;
        userMessage?: AssistantMsg;
        assistantMessage?: AssistantMsg;
        warning?: string | null;
        blockedByGuardrail?: boolean;
      }>('/api/assistant', {
        method: 'POST',
        csrfToken,
        body: JSON.stringify({
          message: trimmed,
          ...(conversationId ? { conversationId } : {}),
        }),
      });
      if (!ok) {
        if (data.blockedByGuardrail) {
          setGuardrailError(data.error || 'Resident personal information cannot be sent to the Care Assistant.');
        } else {
          toast.error(data.error || 'Could not reach Care Assistant.');
        }
        return;
      }
      if (data.warning) toast.info(data.warning);
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.userMessage && data.assistantMessage) {
        setMessages((prev) => [...prev, data.userMessage!, data.assistantMessage!]);
      }
      setInput('');
    } finally {
      setSending(false);
    }
  }

  const quickPrompts = ROLE_PROMPTS[user?.role || 'Caretaker'] || ROLE_PROMPTS.Caretaker;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
          Care Assistant
        </h1>
        <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
          General medicine reference and care-home workflow guidance.
        </p>
      </div>

      {/* Zero-resident-data privacy notice */}
      <div className="rounded-[16px] border border-[var(--cm-primary)]/35 bg-[var(--cm-surface)] p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-[var(--cm-primary)] shrink-0 mt-0.5" />
        <div className="text-[14px] space-y-1">
          <p className="font-semibold text-[var(--cm-text)]">
            Privacy Guardrail Active — Zero Resident Data Transmitted
          </p>
          <p className="text-[var(--cm-muted)]">
            Do not enter resident names, room numbers, dates of birth, or personal prescriptions. The server automatically blocks prompts containing resident names or identifiers. All answers are general information only — always follow the written prescription and facility policy.
          </p>
        </div>
      </div>

      {guardrailError && (
        <div
          role="alert"
          className="rounded-[14px] bg-[var(--cm-danger-bg)] text-[var(--cm-danger)] p-4 flex items-start gap-2.5 text-[14px] font-medium"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{guardrailError}</span>
        </div>
      )}

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={sending}
            onClick={() => void sendQuestion(prompt)}
            className="text-left rounded-[12px] border border-[var(--cm-border)] bg-[var(--cm-surface)] hover:bg-[var(--cm-surface-subtle)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--cm-text)] transition-colors min-h-[44px] inline-flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4 text-[var(--cm-primary)] shrink-0" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* Conversation Feed */}
      <Card className="p-4 sm:p-5 space-y-4 min-h-[320px] flex flex-col justify-between">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Bot className="h-9 w-9 text-[var(--cm-primary)] mx-auto" />
              <p className="text-[16px] font-semibold">Ask a general medication or workflow question</p>
              <p className="text-[14px] text-[var(--cm-muted)] max-w-md mx-auto">
                Examples: medicine storage rules, food timing guidance, or how CareMeds FEFO stock deduction works.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.messageId}
                className={`flex ${m.sender === 'User' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[18px] px-4 py-3 text-[15px] ${
                    m.sender === 'User'
                      ? 'bg-[var(--cm-primary)] text-[var(--cm-primary-foreground)]'
                      : 'bg-[var(--cm-surface-subtle)] text-[var(--cm-text)] border border-[var(--cm-border)]'
                  }`}
                >
                  {m.sender === 'Assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  ) : (
                    <p>{m.content}</p>
                  )}
                  <p
                    className={`text-[11px] mt-1.5 tabular-nums ${
                      m.sender === 'User' ? 'opacity-80' : 'text-[var(--cm-muted)]'
                    }`}
                  >
                    {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendQuestion(input);
          }}
          className="flex gap-2 pt-3 border-t border-[var(--cm-border)]"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a general question (no resident names or personal data)..."
            disabled={sending}
            aria-label="Care Assistant message"
          />
          <Button type="submit" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
            {sending ? 'Thinking...' : 'Ask'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
