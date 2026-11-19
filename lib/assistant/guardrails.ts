import type { RoleName } from '../types';

export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  warning?: string;
}

const RESIDENT_PII_PATTERNS: RegExp[] = [
  /\b(bed|room)\s*[-#:]?\s*[a-z]?\d{2,4}\b/i,
  /\b(mr\.?|mrs\.?|ms\.?|smt\.?|shri)\s+[A-Z][a-z]{2,}\b/,
  /\b\d{10}\b/, // 10-digit phone number
  /\b\d{4}\s?\d{4}\s?\d{4}\b/, // Aadhaar-style 12-digit ID
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b(resident|patient)\s+(named|called|is)\s+[A-Z][a-z]+\b/i,
];

const DOSING_ADVICE_PATTERNS: RegExp[] = [
  /\b(change|increase|decrease|adjust|double|halve|skip|stop)\s+(the\s+)?(dose|dosage|prescription|mg|ml|tablet)\b/i,
  /\bhow\s+much\s+should\s+(i|we)\s+give\b/i,
  /\bcan\s+i\s+give\s+\d+\s*(mg|ml|tablet|tablets|capsule|capsules)\b/i,
  /\bshould\s+we\s+(prescribe|stop|hold)\b/i,
];

export function checkAssistantGuardrails(
  message: string,
  residentNames: string[] = []
): GuardrailCheckResult {
  const lower = message.toLowerCase();

  for (const name of residentNames) {
    const trimmed = name.trim().toLowerCase();
    if (trimmed.length >= 4 && lower.includes(trimmed)) {
      return {
        allowed: false,
        reason:
          'Resident names or identifying details must not be sent to the Care Assistant. Please rephrase your question without naming or describing a specific resident.',
      };
    }
  }

  for (const pattern of RESIDENT_PII_PATTERNS) {
    if (pattern.test(message)) {
      return {
        allowed: false,
        reason:
          'Your message appears to include resident-identifying details (such as a room number, phone number, email, or resident name). The Care Assistant never receives resident data—please remove personal details and ask a general question.',
      };
    }
  }

  for (const pattern of DOSING_ADVICE_PATTERNS) {
    if (pattern.test(message)) {
      return {
        allowed: true,
        warning:
          'Reminder: Care Assistant provides general information only and cannot recommend dosing or prescription changes.',
      };
    }
  }

  return { allowed: true };
}

export function buildAssistantSystemPrompt(role: RoleName): string {
  return [
    'You are the CareMeds Care Assistant, a clinical reference AI for residential elderly care homes.',
    `The staff member asking this question holds the role: ${role}.`,
    '',
    'STRICT CLINICAL SAFETY & PRIVACY RULES (NON-NEGOTIABLE):',
    '1. ZERO-PII: Never receive, request, or echo resident names, room numbers, or personal health records. Keep all responses strictly general.',
    '2. NO DOSING CHANGES: Never recommend altering an individual resident’s prescribed dose. All specific prescription changes must be made by the attending doctor.',
    '3. ROLE FOCUS:',
    '   - Caretakers: General medicine rounds, proper administration timing, safe storage (e.g. insulin fridge rules), documenting refused doses, and recognizing warning signs.',
    '   - Doctors: Geriatric pharmacology, drug interactions, renal/hepatic considerations, and monitoring protocols.',
    '   - Administrators: Facility medicine audits, dual-control verification for controlled drugs, and cold-chain temperature logs.',
    '4. FORMATTING: Structure answers with short, actionable bullet points suitable for busy staff.',
    '',
    'CRITICAL LENGTH LIMIT (STRICT):',
    'Your ENTIRE response MUST be strictly UNDER 600 CHARACTERS in total length. Count characters carefully and do not exceed 600 characters.',
    'Always end with: "General reference only — follow written prescription & policy."',
  ].join('\n');
}
