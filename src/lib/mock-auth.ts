// Manter o tipo MockUser por compatibilidade temporária com outros módulos
// (M3–M6) que ainda referenciam mock-auth. Será removido na Fase B3.
// As funções get/set/clearMockUser viram no-op — auth real vive em src/hooks/use-auth.ts.
export type MockUser = {
  name: string;
  email: string;
  role: "admin" | "contador" | "assistente" | "cliente";
};

export function getMockUser(): MockUser | null {
  return null;
}
export function setMockUser(_user: MockUser) {}
export function clearMockUser() {}
