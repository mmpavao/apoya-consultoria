/**
 * Auth fail-closed para rotas /api/* (modo manual).
 * Sempre valida JWT via supabaseAdmin antes de executar lógica sensível.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type StaffRole = "admin" | "contador" | "assistente" | "supervisor";

const STAFF_ROLES = new Set<string>(["admin", "contador", "assistente", "supervisor"]);

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthResult {
  user: AuthUser;
  role: StaffRole;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

/** Valida JWT. Retorna null se token ausente/inválido (fail-closed). */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/** Retorna role do usuário ou null se não for staff. */
export async function getStaffRole(userId: string): Promise<StaffRole | null> {
  const { data } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = data?.role as string | undefined;
  if (!role || !STAFF_ROLES.has(role)) return null;
  return role as StaffRole;
}

/**
 * Exige usuário staff autenticado.
 * @returns AuthResult ou Response 401/403 (retornar direto ao caller).
 */
export async function requireStaff(
  req: Request,
  allowedRoles?: StaffRole[],
): Promise<AuthResult | Response> {
  const user = await getAuthUser(req);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const role = await getStaffRole(user.id);
  if (!role) return jsonResponse({ error: "Forbidden: perfil sem acesso" }, 403);

  if (allowedRoles && !allowedRoles.includes(role)) {
    return jsonResponse({ error: "Forbidden: permissão insuficiente" }, 403);
  }

  return { user, role };
}

/** Atalho: apenas admin. */
export async function requireAdmin(req: Request): Promise<AuthResult | Response> {
  return requireStaff(req, ["admin"]);
}

/** Financeiro/contábil: admin, contador ou supervisor. */
export async function requireFinanceStaff(req: Request): Promise<AuthResult | Response> {
  return requireStaff(req, ["admin", "contador", "supervisor"]);
}
