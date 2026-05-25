/**
 * Asaas API v3 — HTTP Client (server-only)
 * Nunca importar em código de cliente.
 *
 * Docs: https://docs.asaas.com/reference
 * Base URL prod: https://api.asaas.com/v3
 */

export class AsaasError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AsaasError";
    this.status = status;
    this.body = body;
  }
}

const BASE_URL = "https://api.asaas.com/v3";

/** Busca a API key do escritório no banco de dados */
async function getApiKey(supabaseAdmin: any): Promise<string> {
  // Tenta env var primeiro (secrets do Wrangler)
  const fromEnv = process.env.ASAAS_API_KEY;
  if (fromEnv) return fromEnv;

  // Fallback: busca no banco
  const { data, error } = await supabaseAdmin
    .from("escritorio_config")
    .select("asaas_api_key")
    .single();

  if (error || !data?.asaas_api_key) {
    throw new AsaasError("ASAAS_API_KEY não configurada. Configure em Configurações → Integrações.", 503, null);
  }
  return data.asaas_api_key;
}

type AsaasMethod = "GET" | "POST" | "PUT" | "DELETE";

export async function asaas<T = any>(
  method: AsaasMethod,
  path: string,
  body?: unknown,
  supabaseAdmin?: any,
  apiKeyOverride?: string,
): Promise<T> {
  const apiKey = apiKeyOverride ?? (supabaseAdmin ? await getApiKey(supabaseAdmin) : "");
  if (!apiKey) throw new AsaasError("API key Asaas ausente", 503, null);

  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = text ? JSON.parse(text) : {}; } catch { /* raw text */ }

  if (!res.ok) {
    const msg = (parsed as any)?.errors?.[0]?.description
      ?? (parsed as any)?.message
      ?? `Asaas ${method} ${path} → ${res.status}`;
    console.error(`[asaas] ${method} ${path} → ${res.status}`, parsed);
    throw new AsaasError(msg, res.status, parsed);
  }

  return parsed as T;
}

// ─── CUSTOMERS ──────────────────────────────────────────────────────────────

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
}

/** Cria ou atualiza customer. Retorna customer existente se cpfCnpj já cadastrado. */
export async function upsertCustomer(
  supabaseAdmin: any,
  data: {
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;
    externalReference?: string;
  },
): Promise<AsaasCustomer> {
  const apiKey = await getApiKey(supabaseAdmin);

  // Busca por CPF/CNPJ primeiro
  try {
    const existing = await asaas<{ data: AsaasCustomer[] }>(
      "GET",
      `/customers?cpfCnpj=${data.cpfCnpj.replace(/\D/g, "")}&limit=1`,
      undefined, undefined, apiKey,
    );
    if (existing.data?.length > 0) return existing.data[0];
  } catch { /* ignora erro de busca — tenta criar */ }

  return asaas<AsaasCustomer>(
    "POST",
    "/customers",
    {
      name: data.name,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
      email: data.email ?? undefined,
      mobilePhone: data.mobilePhone?.replace(/\D/g, "") ?? undefined,
      externalReference: data.externalReference ?? undefined,
    },
    undefined,
    apiKey,
  );
}

// ─── PAYMENTS ───────────────────────────────────────────────────────────────

export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export interface AsaasPayment {
  id: string;
  status: string;
  billingType: BillingType;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  pixQrCodeId?: string;
  description?: string;
  externalReference?: string;
}

export interface AsaasPixData {
  encodedImage: string;  // base64 QR
  payload: string;       // copia-e-cola
  expirationDate: string;
}

/** Cria cobrança no Asaas. billingType UNDEFINED = aceita PIX + boleto */
export async function createPayment(
  supabaseAdmin: any,
  data: {
    customer: string;           // asaas customer ID
    billingType: BillingType;
    value: number;
    dueDate: string;            // YYYY-MM-DD
    description: string;
    externalReference?: string; // nossa cobranca.id
    postalService?: boolean;
    installmentCount?: number;
    installmentValue?: number;
  },
): Promise<AsaasPayment> {
  return asaas<AsaasPayment>(
    "POST",
    "/payments",
    { ...data },
    supabaseAdmin,
  );
}

/** Busca dados PIX de uma cobrança */
export async function getPixData(
  supabaseAdmin: any,
  paymentId: string,
): Promise<AsaasPixData> {
  return asaas<AsaasPixData>(
    "GET",
    `/payments/${paymentId}/pixQrCode`,
    undefined,
    supabaseAdmin,
  );
}

/** Cancela pagamento no Asaas */
export async function cancelPayment(
  supabaseAdmin: any,
  paymentId: string,
): Promise<void> {
  await asaas("DELETE", `/payments/${paymentId}`, undefined, supabaseAdmin);
}

/** Busca detalhes de um pagamento */
export async function getPayment(
  supabaseAdmin: any,
  paymentId: string,
): Promise<AsaasPayment> {
  return asaas<AsaasPayment>("GET", `/payments/${paymentId}`, undefined, supabaseAdmin);
}
