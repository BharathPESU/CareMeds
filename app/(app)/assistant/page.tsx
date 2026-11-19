'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Markdown from 'react-markdown';
import {
  AlertCircle,
  Bot,
  ExternalLink,
  Loader2,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/CareMedsProviders';
import { Button } from '@/components/ui/button';
import { Card, Input } from '@/components/ui/primitives';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/time';

declare global {
  interface Window {
    puter?: {
      ai?: {
        chat?: (prompt: string | unknown[], options?: unknown) => Promise<unknown>;
        txt2speech?: (text: string, options?: unknown) => Promise<HTMLAudioElement>;
        speech2txt?: (audio: Blob | ArrayBuffer, options?: unknown) => Promise<string>;
      };
    };
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}

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

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_~`>[\]()]/g, '')
    .replace(/- /g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

export default function AssistantPage() {
  const { user, csrfToken } = useAuth();
  const [messages, setMessages] = useState<AssistantMsg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [guardrailError, setGuardrailError] = useState<string | null>(null);

  // Speech-to-Text (STT) state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Text-to-Speech (TTS) state
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

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
      stopAudioPlayback();
      stopDictation();
    };
  }, []);

  function stopAudioPlayback() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingMessageId(null);
  }

  async function playInLoudVoice(messageId: string, text: string) {
    // If already playing this message, clicking again toggles it off
    if (playingMessageId === messageId) {
      stopAudioPlayback();
      return;
    }

    stopAudioPlayback();
    const cleanText = stripMarkdown(text);
    if (!cleanText) return;

    // First attempt: Puter.js txt2speech
    if (typeof window !== 'undefined' && window.puter?.ai?.txt2speech) {
      try {
        toast.info('Generating loud voice audio with Puter.js...');
        const audio = await window.puter.ai.txt2speech(cleanText);
        audio.volume = 1.0; // 100% volume for maximum loudness
        audio.onended = () => {
          setPlayingMessageId(null);
          currentAudioRef.current = null;
        };
        audio.onerror = () => {
          console.warn('Puter audio playback error, falling back to Web Speech API');
          fallbackWebSpeech(cleanText, messageId);
        };
        currentAudioRef.current = audio;
        setPlayingMessageId(messageId);
        await audio.play();
        return;
      } catch (err) {
        console.warn('Puter.ai.txt2speech failed:', err);
      }
    }

    // Fallback: Web Speech API with maximum loudness
    fallbackWebSpeech(cleanText, messageId);
  }

  function fallbackWebSpeech(cleanText: string, messageId: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Voice playback is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.volume = 1.0; // Loudest voice
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setPlayingMessageId(null);
    utterance.onerror = () => setPlayingMessageId(null);

    setPlayingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
    toast.success('Reading response aloud in loud voice.');
  }

  function startDictation() {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Microphone active. Speak your question...');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          toast.error(`Microphone error: ${event.error || 'Check microphone permissions'}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      toast.error('Could not access microphone. Please grant permission.');
    }
  }

  function stopDictation() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setGuardrailError(null);
    setSending(true);
    stopAudioPlayback();
    stopDictation();

    try {
      const { ok, data } = await apiFetch<{
        conversationId?: string;
        userMessage?: AssistantMsg;
        assistantMessage?: AssistantMsg;
        warning?: string | null;
        blockedByGuardrail?: boolean;
        charCount?: number;
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
        const assistantMsg = data.assistantMessage;
        setMessages((prev) => [...prev, data.userMessage!, assistantMsg]);
        toast.success(`Response ready (${assistantMsg.content.length}/600 chars). Click 🔊 to read aloud.`);
      }
      setInput('');
    } finally {
      setSending(false);
    }
  }

  const quickPrompts = ROLE_PROMPTS[user?.role || 'Caretaker'] || ROLE_PROMPTS.Caretaker;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Load Puter.js SDK */}
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--cm-text)]">
            Care Assistant
          </h1>
          <p className="text-[15px] text-[var(--cm-muted)] mt-0.5">
            Voice-enabled medication reference with Puter.js & round-robin Gemini quota protection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[var(--cm-primary)]/10 text-[var(--cm-primary)] border border-[var(--cm-primary)]/20">
            <Sparkles className="h-3.5 w-3.5" />
            Max 600 chars
          </span>
        </div>
      </div>

      {/* Zero-resident-data privacy notice */}
      <div className="rounded-[16px] border border-[var(--cm-primary)]/35 bg-[var(--cm-surface)] p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-[var(--cm-primary)] shrink-0 mt-0.5" />
        <div className="text-[14px] space-y-1">
          <p className="font-semibold text-[var(--cm-text)]">
            Privacy Guardrail Active — Zero Resident Data Transmitted
          </p>
          <p className="text-[var(--cm-muted)]">
            Do not enter resident names, room numbers, dates of birth, or personal prescriptions. The server automatically blocks prompts containing resident names or identifiers. All answers are general information only and strictly limited to under 600 characters.
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
      <Card className="p-4 sm:p-5 space-y-4 min-h-[360px] flex flex-col justify-between">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Bot className="h-9 w-9 text-[var(--cm-primary)] mx-auto" />
              <p className="text-[16px] font-semibold">Ask a general medication or workflow question</p>
              <p className="text-[14px] text-[var(--cm-muted)] max-w-md mx-auto">
                Use the mic button below to dictate your question or type it in. The AI will respond concisely (under 600 characters) with a speaker button to read aloud in a loud voice.
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
                      : 'bg-[var(--cm-surface-subtle)] text-[var(--cm-text)] border border-[var(--cm-border)] shadow-sm'
                  }`}
                >
                  {m.sender === 'Assistant' ? (
                    <div>
                      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                        <Markdown>{m.content}</Markdown>
                      </div>

                      {/* Assistant actions: Loud Speaker Button & Length Pill */}
                      <div className="mt-3 pt-2.5 border-t border-[var(--cm-border)] flex flex-wrap items-center justify-between gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={playingMessageId === m.messageId ? 'danger' : 'secondary'}
                          onClick={() => void playInLoudVoice(m.messageId, m.content)}
                          className="h-8 px-3 text-[12px] font-semibold inline-flex items-center gap-1.5 shadow-sm"
                          aria-label={
                            playingMessageId === m.messageId
                              ? 'Stop reading in loud voice'
                              : 'Read response in loud voice'
                          }
                        >
                          {playingMessageId === m.messageId ? (
                            <>
                              <Square className="h-3.5 w-3.5 fill-current animate-pulse" />
                              <span>Stop Speaking</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5 text-[var(--cm-primary)]" />
                              <span>Read Aloud (Loud)</span>
                            </>
                          )}
                        </Button>

                        <div className="flex items-center gap-2 text-[11px] text-[var(--cm-muted)]">
                          <span className="font-mono">{m.content.length}/600 chars</span>
                          <span>•</span>
                          <span>{formatDateTime(m.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>{m.content}</p>
                      <p className="text-[11px] mt-1.5 tabular-nums opacity-80 text-right">
                        {formatDateTime(m.createdAt)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Bar with Mic button & Send button */}
        <div className="pt-3 border-t border-[var(--cm-border)] space-y-2">
          {isListening && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[13px] animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="font-medium">Listening... Dictate your question now</span>
              <button
                type="button"
                onClick={stopDictation}
                className="ml-auto text-[11px] underline hover:opacity-80"
              >
                Stop dictation
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuestion(input);
            }}
            className="flex items-center gap-2"
          >
            {/* Mic Dictation Button */}
            <Button
              type="button"
              variant={isListening ? 'danger' : 'secondary'}
              onClick={isListening ? stopDictation : startDictation}
              disabled={sending}
              className={`h-11 px-3.5 shrink-0 transition-all ${
                isListening
                  ? 'ring-2 ring-red-500 bg-red-600 text-white hover:bg-red-700'
                  : 'hover:bg-[var(--cm-surface-subtle)]'
              }`}
              title={isListening ? 'Stop dictation' : 'Click to dictate via microphone'}
              aria-label={isListening ? 'Stop microphone dictation' : 'Start microphone dictation'}
            >
              {isListening ? (
                <MicOff className="h-5 w-5 animate-pulse" />
              ) : (
                <Mic className="h-5 w-5 text-[var(--cm-primary)]" />
              )}
            </Button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? 'Listening to speech...'
                  : 'Ask a general question (or click the mic to dictate)...'
              }
              disabled={sending}
              aria-label="Care Assistant question input"
              className="h-11 text-[15px]"
            />

            {/* Send Button */}
            <Button
              type="submit"
              disabled={sending || !input.trim()}
              className="h-11 px-4 shrink-0 font-medium inline-flex items-center gap-1.5"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </>
              )}
            </Button>
          </form>

          {/* Footer with Puter.js attribution link */}
          <div className="flex items-center justify-between text-[11px] text-[var(--cm-muted)] px-1 pt-1">
            <span>Clinical guidance only • Zero resident data policy</span>
            <a
              href="https://developer.puter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--cm-primary)] transition-colors underline underline-offset-2"
            >
              Powered by Puter.js
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
