// Mock auth helper — substituído por Supabase Auth no módulo M7.
export type MockUser = { name: string; email: string; role: "admin" | "fiscal" | "financeiro" | "dp" };

const KEY = "apoya_mock_user";

export function getMockUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockUser) : null;
  } catch {
    return null;
  }
}

export function setMockUser(user: MockUser) {
  window.localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearMockUser() {
  window.localStorage.removeItem(KEY);
}
