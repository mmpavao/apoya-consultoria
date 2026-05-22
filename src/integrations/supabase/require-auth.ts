/**
 * Middleware simples: verifica token Supabase sem checar roles.
 * Usa supabaseAdmin para operações que precisam bypassar RLS.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "./client.server";

export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    if (!request?.headers) throw new Error("Unauthorized: no request headers");

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized: missing Bearer token");

    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) throw new Error("Unauthorized: invalid token");

    return next({ context: { userId: data.user.id } });
  },
);
