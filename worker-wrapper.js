// Worker entry point para TanStack Start + Cloudflare Workers
// workerEntry no index.js é {} vazio — usar server_default (export a1)
import { a1 as serverModule } from "./dist/server/index.js";

const handler = serverModule.default;

export default {
  async fetch(request, env, ctx) {
    if (!handler || typeof handler.fetch !== 'function') {
      return new Response('Server not ready', { status: 503 });
    }
    return handler.fetch(request, env, ctx);
  }
};
