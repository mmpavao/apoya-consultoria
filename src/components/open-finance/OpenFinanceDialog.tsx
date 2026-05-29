/**
 * OpenFinanceDialog — Dialog wrapper para conectar banco via Pluggy Connect
 *
 * Uso simples em qualquer tela:
 *   <OpenFinanceDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     clienteId={cliente.id}
 *     clienteNome={cliente.razao_social}
 *     onConnected={(itemId) => { ... salvar no Supabase ... }}
 *   />
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2 } from "lucide-react";
import { PluggyConnectWidget } from "./PluggyConnectWidget";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  /** ID da empresa no Supabase */
  clienteId?: string;
  /** Nome para exibição no header */
  clienteNome?: string;
  /** Callback após conexão bem-sucedida — recebe o item_id da Pluggy */
  onConnected?: (itemId: string) => void;
  /** Modo sandbox Pluggy (apenas em dev) */
  sandbox?: boolean;
};

export function OpenFinanceDialog({
  open,
  onClose,
  clienteId,
  clienteNome,
  onConnected,
  sandbox = false,
}: Props) {

  async function handleSuccess(itemId: string, itemData: unknown) {
    // Salvar a conexão no Supabase para uso futuro (extratos, conciliação)
    if (clienteId && itemId) {
      const { error } = await (supabase as any)
        .from("open_finance_conexoes")
        .upsert({
          empresa_id:   clienteId,
          item_id:      itemId,
          item_data:    itemData,
          status:       "ativo",
          conectado_em: new Date().toISOString(),
        }, { onConflict: "item_id" });

      if (error) {
        console.error("[OpenFinance] erro ao salvar conexão:", error);
        toast.error("Banco conectado, mas houve um erro ao salvar. Contate o suporte.");
      }
    }

    onConnected?.(itemId);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">
                Conectar conta bancária
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {clienteNome
                  ? `Conectando conta de ${clienteNome}`
                  : "Autorize o acesso ao extrato bancário via Open Finance"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 min-h-[300px]">
          {open && (
            <PluggyConnectWidget
              clienteId={clienteId}
              onSuccess={handleSuccess}
              onClose={onClose}
              sandbox={sandbox}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
