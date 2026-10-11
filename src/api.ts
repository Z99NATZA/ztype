import type { TextSet, SetDraft } from '../shared/types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const api = {
  list: () => request<TextSet[]>('/sets'),
  create: (draft: SetDraft) => request<TextSet>('/sets', { method: 'POST', body: JSON.stringify(draft) }),
  update: (id: string, draft: SetDraft) => request<TextSet>(`/sets/${id}`, { method: 'PUT', body: JSON.stringify(draft) }),
  delete: (id: string) => request<void>(`/sets/${id}`, { method: 'DELETE' }),
};
