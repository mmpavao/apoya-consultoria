/**
 * parse-certificate — Edge Function
 * Recebe PFX em base64 + senha, extrai metadados (titular, CNPJ, validade, serial)
 * usando o binário openssl disponível no runtime Deno do Supabase.
 * 
 * Retorna: { ok, nomeRazao, cnpj, serial, validoAte, tipo }
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { requireUser } from "../_shared/agent.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ⚠️ INERTE em prod: depende de subprocess openssl, bloqueado pelo Edge Runtime
// (sempre 500). NÃO está no deploy.yml. Antes de usar, trocar openssl por um
// parser PKCS12 em WASM/JS. Guard requireUser já posto p/ não nascer oráculo
// público de senha de certificado quando/se for deployada.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const denied = await requireUser(req, CORS);
  if (denied) return denied;

  try {
    const { pfxBase64, password } = await req.json();
    if (!pfxBase64 || !password) {
      return Response.json({ ok: false, error: "pfxBase64 e password são obrigatórios" }, { headers: CORS, status: 400 });
    }

    // Decodificar base64 → bytes
    const pfxBytes = Uint8Array.from(atob(pfxBase64), c => c.charCodeAt(0));

    // Salvar em arquivo temporário
    const tmpPfx  = `/tmp/cert_${Date.now()}.pfx`;
    const tmpCert = `/tmp/cert_${Date.now()}.pem`;
    await Deno.writeFile(tmpPfx, pfxBytes);

    // Extrair certificado PEM com openssl (flag -legacy para compatibilidade ICP-Brasil)
    const openssl = new Deno.Command("openssl", {
      args: ["pkcs12", "-in", tmpPfx, "-nokeys", "-passin", `pass:${password}`, "-legacy", "-out", tmpCert],
      stderr: "piped",
    });
    const { code } = await openssl.output();

    if (code !== 0) {
      // Tentar sem -legacy
      const openssl2 = new Deno.Command("openssl", {
        args: ["pkcs12", "-in", tmpPfx, "-nokeys", "-passin", `pass:${password}`, "-out", tmpCert],
        stderr: "piped",
      });
      const { code: code2 } = await openssl2.output();
      if (code2 !== 0) {
        return Response.json({ ok: false, error: "Senha incorreta ou certificado inválido" }, { headers: CORS, status: 422 });
      }
    }

    // Ler dados do certificado
    const getData = new Deno.Command("openssl", {
      args: ["x509", "-in", tmpCert, "-noout", "-subject", "-dates", "-serial"],
      stdout: "piped",
    });
    const { stdout } = await getData.output();
    const info = new TextDecoder().decode(stdout);

    // Parsear subject
    const subjectMatch = info.match(/subject=(.+)/);
    const subject = subjectMatch?.[1] ?? "";

    // Extrair CN (ex: "APOYA AUDITORIA, CONSULTORIA E CONTABILIDADE LTDA:43507838000189")
    const cnMatch = subject.match(/CN\s*=\s*"?([^,\n"]+)"?/);
    const cn = cnMatch?.[1]?.trim() ?? "";

    let nomeRazao = cn;
    let cnpjLimpo = "";

    // Formato ICP-Brasil: NOME:CNPJ
    if (cn.includes(":")) {
      const parts = cn.split(":");
      nomeRazao = parts[0].trim();
      cnpjLimpo = parts[1]?.replace(/\D/g, "").trim() ?? "";
    }

    // Validade
    const notAfterMatch = info.match(/notAfter=(.+)/);
    let validoAte = "";
    if (notAfterMatch) {
      const d = new Date(notAfterMatch[1].trim());
      if (!isNaN(d.getTime())) validoAte = d.toISOString().split("T")[0];
    }

    // Serial
    const serialMatch = info.match(/serial=([A-Fa-f0-9]+)/i);
    const serial = serialMatch?.[1]?.toUpperCase() ?? "";

    // Detectar tipo A1 vs A3 (A3 tem "A3" no OU ou subject)
    const tipo: "A1" | "A3" = subject.toUpperCase().includes("A3") ? "A3" : "A1";

    // Limpar temporários
    try { await Deno.remove(tmpPfx); await Deno.remove(tmpCert); } catch { /**/ }

    return Response.json({
      ok:        true,
      nomeRazao,
      cnpj:      cnpjLimpo,
      serial,
      validoAte,
      tipo,
    }, { headers: CORS });

  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { headers: CORS, status: 500 });
  }
});
