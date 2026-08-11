"use client";

import { useRouter } from "next/navigation";
import { X, Phone, Mail, Sparkles, MessageSquare } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { LgpdLeadActions } from "./LgpdLeadActions";
import { Button } from "@/components/ui";

export function LeadDetail({
  lead,
  onClose,
  podeGerir = false,
}: {
  lead: Lead | null;
  onClose: () => void;
  podeGerir?: boolean;
}) {
  const router = useRouter();
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-escuro-quente/40 transition-opacity ${
          lead ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Painel lateral */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-superficie shadow-2xl transition-transform duration-300 ${
          lead ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {lead && (
          <>
            <div className="flex items-center justify-between border-b border-borda px-6 py-4">
              <h2 className="font-corpo text-lg font-bold text-texto">
                Raio-X do Cliente
              </h2>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-md p-2.5 text-texto-suave hover:bg-fundo-2"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {/* Nome */}
              <div>
                <h3 className="text-xl font-bold text-texto">{lead.nome}</h3>
                <span className="text-xs text-texto-suave">Vindo de {lead.origem}</span>
                {lead.anuncio && (
                  <span
                    className="mt-1 flex items-center gap-1 text-xs font-medium text-marca"
                    title={lead.anuncio}
                  >
                    📣 <span className="truncate">{lead.anuncio}</span>
                  </span>
                )}
                {lead.posVenda && (
                  <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-marca-suave px-2 py-0.5 text-[11px] font-semibold text-marca">
                    💛 Pós-venda
                  </span>
                )}
              </div>

              {/* Dados pessoais */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
                  Dados Pessoais
                </p>
                <div className="flex items-center gap-2 text-sm text-texto">
                  <Phone size={15} className="text-texto-suave" />
                  {lead.telefone}
                </div>
                <div className="flex items-center gap-2 text-sm text-texto">
                  <Mail size={15} className="text-texto-suave" />
                  {lead.email}
                </div>
              </div>

              {/* Diagnóstico da IA */}
              <div className="rounded-lg bg-marca-suave/50 p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-marca">
                  <Sparkles size={13} /> Diagnóstico Rápido (IA)
                </p>
                <p className="text-sm leading-relaxed text-texto">
                  {lead.diagnostico}
                </p>
              </div>

              {/* Notas internas */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-texto-suave">
                  Anotações da Equipe
                </p>
                <textarea
                  rows={4}
                  placeholder="Escreva aqui detalhes importantes sobre a negociação que só sua equipe vai ver..."
                  className="w-full resize-none rounded-md border border-borda bg-fundo p-3 text-sm text-texto outline-none placeholder:text-texto-suave/70 focus:border-marca"
                />
              </div>

              {/* Privacidade (LGPD) — só para gestor */}
              {podeGerir && <LgpdLeadActions leadId={lead.id} nome={lead.nome} />}
            </div>

            {/* Ação principal */}
            <div className="border-t border-borda px-6 py-4">
              <Button
                variant="primary"
                onClick={() => router.push(`/atendimento?conversa=${lead.id}`)}
                className="w-full"
              >
                <MessageSquare size={16} />
                Assumir Atendimento no Chat
              </Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
