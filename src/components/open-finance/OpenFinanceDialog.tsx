/**
 * OpenFinanceDialog — Dialog para conectar banco via Pluggy Connect
 *
 * Uso simples em qualquer tela:
 *   <OpenFinanceDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     clienteId={cliente.id}
 *     onConnected={(itemId) => console.log("Banco conectado:", itemId)}
 *   />
 */
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PluggyConnectWidget } from "./PluggyConnectWidget";
import { Shield, Landmark } from "lucide-react";
import { toast } from "sonner";

interface OpenFinanceDialogProps {
  open: boolean;
  onClose: () => void;
  clienteId?: string;
  clienteNome?: string;
  onConnected?: (itemId: string) => void;
}

export function OpenFinanceDialog({
  open,
  onClose,
  clienteId,
  clienteNome,
  onConnected,
}: OpenFinanceDialogProps) {
  function handleSuccess(itemId: string) {
    toast.success("Banco conectado! Os extratos serão sincronizados automaticamente.");
    onConnected?.(itemId);
    onClose();
  }

  function handleError(err: Error) {
    toast.error(`Erro na conexão: ${err.message}`);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Cabeçalho */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Landmark className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Open Finance
                {clienteNome ? ` — ${clienteNome}` : ""}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Conecte sua conta bancária para sincronização automática de extratos
              </DialogDescription>
            </div>
          </div>
          {/* Badge de segurança */}
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-green-600" />
            <span>Conexão segura via Open Finance regulamentado pelo Banco Central</span>
          </div>
        </DialogHeader>

        {/* Widget Pluggy */}
        <div className="min-h-[400px]">
          {open && (
            <PluggyConnectWidget
              clienteId={clienteId}
              onSuccess={handleSuccess}
              onClose={onClose}
              onError={handleError}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
