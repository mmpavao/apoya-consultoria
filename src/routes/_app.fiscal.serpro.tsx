import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, CheckCircle2, RefreshCw, Server, Shield, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PagePlaceholder";
import { dasStore } from "@/lib/das-store";

export const Route = createFileRoute("/_app/fiscal/serpro")({
  component: SerproPage,
  head: () => ({ meta: [{ title: "SERPRO · APOYA Gestão" }] }),
});

interface Health {
  online: boolean;
  latencyMs: number;
  cpu: number;
  memMb: number;
  certExpira: string;
  checkedAt: string;
}

function mockHealth(): Health {
  return {
    online: Math.random() > 0.05,
    latencyMs: Math.round(120 + Math.random() * 200),
    cpu: Math.round(10 + Math.random() * 35),
    memMb: Math.round(380 + Math.random() * 120),
    certExpira: "2026-11-14",
    checkedAt: new Date().toISOString(),
  };
}

function SerproPage() {
  const [health, setHealth] = useState<Health>(() => mockHealth());
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setHealth(mockHealth());
    setLoading(false);
  }

  useEffect(() => {
    const t = setInterval(() => setHealth(mockHealth()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Últimas consultas: deriva das DAS geradas/erradas mais recentes
  const consultas = dasStore.list()
    .filter((g) => g.geradoEm || g.erro)
    .sort((a, b) => (b.geradoEm ?? "").localeCompare(a.geradoEm ?? ""))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SERPRO Gateway"
        subtitle="Monitoramento do gateway serpro.apoya.com.br:4010"
        actions={
          <Button variant="outline" className="rounded-xl" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          icon={health.online ? CheckCircle2 : XCircle}
          tone={health.online ? "success" : "destructive"}
          label="Status do gateway"
          value={health.online ? "Online" : "Offline"}
          hint={`Verificado ${formatTime(health.checkedAt)}`}
        />
        <StatusCard icon={Activity} tone="info" label="Latência" value={`${health.latencyMs} ms`} hint="Última consulta" />
        <StatusCard icon={Server} tone="default" label="Recursos VPS" value={`CPU ${health.cpu}% · ${health.memMb} MB`} hint="Hetzner / Ubuntu 22.04" />
        <StatusCard icon={Shield} tone="success" label="Certificado A1" value="Válido" hint={`Expira em ${formatDate(health.certExpira)}`} />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <div className="font-semibold">Últimas consultas SERPRO</div>
            <div className="text-xs text-muted-foreground">Histórico de chamadas ao gateway (mock)</div>
          </div>
          <Badge variant="outline" className="rounded-full">v1.4.2</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consultas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma consulta registrada. Gere DAS para popular o histórico.
                </TableCell>
              </TableRow>
            )}
            {consultas.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="text-sm">{g.geradoEm ? formatTime(g.geradoEm) : "—"}</TableCell>
                <TableCell className="font-medium">{g.clienteNome}</TableCell>
                <TableCell className="font-mono text-xs">{g.cnpj}</TableCell>
                <TableCell>Gerar DAS {g.competencia}</TableCell>
                <TableCell>
                  {g.status === "erro" ? (
                    <Badge variant="outline" className="rounded-full border-destructive/20 bg-destructive/10 text-destructive">
                      Erro
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full border-success/20 bg-success/10 text-success">
                      200 OK
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function StatusCard({ icon: Icon, label, value, hint, tone }: {
  icon: typeof Activity; label: string; value: string; hint: string;
  tone: "default" | "info" | "destructive" | "success";
}) {
  const toneCls = {
    default: "bg-muted text-foreground",
    info: "bg-info/10 text-info",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
