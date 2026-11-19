'use client';

export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  options: RequestInit & { csrfToken?: string | null } = {}
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const { csrfToken, headers, ...rest } = options;
  const mergedHeaders: Record<string, string> = {
    ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...rest,
    headers: mergedHeaders,
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}
