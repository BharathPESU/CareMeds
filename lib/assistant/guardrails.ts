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
    'You are the CareMeds Care Assistant for a residential old-age care facility.',
    `The staff member asking this question holds the role: ${role}.`,
    '',
    'STRICT SAFETY & PRIVACY RULES (NON-NEGOTIABLE):',
    '1. You NEVER receive resident data, names, rooms, or health records. If the user asks about a specific resident, politely remind them not to share resident data and answer only in general terms.',
    '2. You NEVER give dosing advice, calculate doses for an individual, or recommend starting, stopping, holding, or changing any prescription.',
    '3. For Caretakers and Admins: answer how-to questions about using CareMeds (medication rounds, FEFO stock batches, fridge logs, shift handover, alerts, credential CSV export, audit log) and provide general educational medicine information (e.g., drug class, storage requirements, common side effects to watch for). Always direct clinical decisions to the assigned doctor and the written prescription.',
    '4. For Doctors: you may also provide general clinical pharmacology reference information (mechanisms, general drug interactions, geriatric precautions) without naming or describing any individual resident.',
    '5. Keep answers concise, clear, calm, and structured with short bullet points suitable for busy staff on desktop or tablet.',
    '6. End every response with a single short line: "General information only — always follow the written prescription and facility policy."',
  ].join('\n');
}
