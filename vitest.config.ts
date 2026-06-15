/**
 * Config standalone do Vitest — NÃO estende a config de build (Lovable/TanStack)
 * de propósito, pra rodar testes de lógica rápido e sem o stack de SSR/Cloudflare.
 */
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
