/**
 * /checkout/:id — Página pública de checkout
 * NÃO requer autenticação.
 * Exibe: PIX (QR + copia-e-cola) + Boleto + Cartão (Asaas embed)
 */
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, CheckCircle2, FileText, CreditCard, QrCode, Loader2, AlertCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/$id")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Pagamento Seguro · APOYA" }] }),
});

interface CheckoutData {
  id: string;
  clienteNome: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  pixCopiaCola?: string;
  boletoUrl?: string;
  asaasInvoiceUrl?: string;
  linkPagamento?: string;
}

const fmtBRL  = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

function StatusBadge({ status }: { status: string }) {
  const c = status === "paga" ? "bg-green-100 text-green-700 border-green-200"
    : status === "vencida"   ? "bg-red-100 text-red-700 border-red-200"
    : "bg-blue-100 text-blue-700 border-blue-200";
  const l = status === "paga" ? "✅ Pago" : status === "vencida" ? "⚠️ Vencida" : "⏳ Em aberto";
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c}`}>{l}</span>;
}

type Tab = "pix" | "boleto" | "cartao";

export default function CheckoutPage() {
  const { id } = useParams({ from: "/checkout/$id" });
  const [data, setData]       = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<Tab>("pix");
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/checkout/${id}`);
        const json = await res.json() as any;
        if (!res.ok || json.error) throw new Error(json.error ?? "Cobrança não encontrada");
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function copyPix() {
    if (!data?.pixCopiaCola) return;
    navigator.clipboard.writeText(data.pixCopiaCola).then(() => {
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7]">
        <Loader2 className="w-8 h-8 text-[#E8721C] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7]">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <p className="text-lg font-semibold text-gray-800">Cobrança não encontrada</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (data.status === "paga") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7]">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-[#0F1628]">Pagamento Confirmado!</h1>
          <p className="text-gray-600">Obrigado, <strong>{data.clienteNome.split(" ")[0]}</strong>. Sua conta está ativa. 🎉</p>
          <p className="text-sm text-gray-400">APOYA Auditoria, Consultoria e Contabilidade</p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof QrCode; disabled: boolean }[] = [
    { key: "pix",    label: "PIX",    icon: QrCode,      disabled: !data.pixCopiaCola },
    { key: "boleto", label: "Boleto", icon: FileText,     disabled: !data.boletoUrl && !data.asaasInvoiceUrl },
    { key: "cartao", label: "Cartão", icon: CreditCard,   disabled: !data.asaasInvoiceUrl },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      {/* Header */}
      <header className="bg-[#0F1628] text-white py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-[#E8721C]" />
          <div>
            <p className="font-semibold text-sm">APOYA Contabilidade</p>
            <p className="text-xs text-white/60">Pagamento Seguro</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/60">CNPJ 43.507.838/0001-89</p>
        </div>
      </header>

      {/* Linha laranja */}
      <div className="h-1 bg-gradient-to-r from-[#E8721C] to-[#f59e0b]" />

      {/* Conteúdo */}
      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md space-y-4">

          {/* Card de resumo */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cobrança</p>
                <p className="text-xl font-bold text-[#0F1628] mt-0.5">{fmtBRL(data.valor)}</p>
                <p className="text-sm text-gray-600 mt-1">{data.descricao}</p>
              </div>
              <StatusBadge status={data.status} />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Cliente: <strong className="text-gray-700">{data.clienteNome}</strong></span>
              <span>Vence: <strong className="text-gray-700">{fmtDate(data.vencimento)}</strong></span>
            </div>
          </div>

          {/* Tabs de pagamento */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => !t.disabled && setTab(t.key)}
                  disabled={t.disabled}
                  className={[
                    "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors",
                    tab === t.key
                      ? "text-[#E8721C] border-b-2 border-[#E8721C] bg-orange-50/50"
                      : "text-gray-500 hover:text-gray-700",
                    t.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* ── PIX ── */}
              {tab === "pix" && data.pixCopiaCola && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 text-center">
                    Copie o código abaixo e cole no app do seu banco
                  </p>
                  <div className="bg-gray-50 rounded-xl p-3 break-all text-xs font-mono text-gray-700 border border-gray-200 max-h-24 overflow-auto">
                    {data.pixCopiaCola}
                  </div>
                  <Button
                    onClick={copyPix}
                    className="w-full bg-[#E8721C] hover:bg-[#d4681a] text-white rounded-xl h-11 font-semibold gap-2"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copiado!" : "Copiar código PIX"}
                  </Button>
                  <p className="text-xs text-center text-gray-400">
                    ⚡ O pagamento é confirmado em instantes
                  </p>
                </div>
              )}

              {/* ── BOLETO ── */}
              {tab === "boleto" && (data.boletoUrl || data.asaasInvoiceUrl) && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 text-center">
                    Clique abaixo para abrir ou imprimir o boleto bancário
                  </p>
                  <a
                    href={data.boletoUrl ?? data.asaasInvoiceUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button className="w-full bg-[#0F1628] hover:bg-[#1a2444] text-white rounded-xl h-11 font-semibold gap-2">
                      <FileText className="w-4 h-4" />
                      Abrir Boleto PDF
                    </Button>
                  </a>
                  <p className="text-xs text-center text-gray-400">
                    ⏱ Prazo de compensação: 1-3 dias úteis
                  </p>
                </div>
              )}

              {/* ── CARTÃO ── */}
              {tab === "cartao" && data.asaasInvoiceUrl && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 text-center">
                    Pague com cartão de crédito diretamente no portal Asaas
                  </p>
                  <a
                    href={data.asaasInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button className="w-full bg-[#E8721C] hover:bg-[#d4681a] text-white rounded-xl h-11 font-semibold gap-2">
                      <CreditCard className="w-4 h-4" />
                      Pagar com Cartão
                    </Button>
                  </a>
                  <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
                    <span>🔒 Ambiente seguro</span>
                    <span>•</span>
                    <span>Asaas Payments</span>
                  </div>
                </div>
              )}

              {/* Fallback — sem formas configuradas */}
              {((tab === "pix" && !data.pixCopiaCola) ||
                (tab === "boleto" && !data.boletoUrl && !data.asaasInvoiceUrl) ||
                (tab === "cartao" && !data.asaasInvoiceUrl)) && (
                <div className="text-center py-6 text-gray-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Forma de pagamento não disponível.</p>
                  <p className="text-xs mt-1">Entre em contato: (12) 99685-3626</p>
                </div>
              )}
            </div>
          </div>

          {/* Rodapé */}
          <p className="text-center text-xs text-gray-400 pb-8">
            APOYA Auditoria, Consultoria e Contabilidade Ltda<br />
            CNPJ 43.507.838/0001-89 · CRC 2SP044240/O-0<br />
            contato@apoya.com.br · (12) 3653-2356
          </p>
        </div>
      </main>
    </div>
  );
}
