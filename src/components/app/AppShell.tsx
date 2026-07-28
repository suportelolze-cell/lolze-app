"use client";

import { useState } from "react";
import { Menu, Eye, LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SuporteWidget } from "./SuporteWidget";
import { Logo } from "@/components/Logo";
import { sairImpersonacao } from "@/lib/admin/actions";

export function AppShell({
  children,
  papel = "owner",
  impersonating = false,
  clienteNome = "",
}: {
  children: React.ReactNode;
  papel?: string;
  impersonating?: boolean;
  clienteNome?: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="min-h-screen bg-fundo">
      <Sidebar
        aberto={aberto}
        onClose={() => setAberto(false)}
        papel={papel}
        impersonating={impersonating}
      />

      {/* Backdrop (mobile, quando o drawer está aberto) */}
      {aberto && (
        <div
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-30 bg-escuro-quente/40 lg:hidden"
        />
      )}

      <div className="lg:pl-64 print-reset-pad">
        {/* Faixa de impersonation (superadmin vendo como cliente) */}
        {impersonating && (
          <div className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-marca px-4 py-2 text-sm text-bege-principal">
            <span className="flex items-center gap-2">
              <Eye size={16} /> Você está vendo como{" "}
              <strong>{clienteNome || "cliente"}</strong>.
            </span>
            <form action={sairImpersonacao}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-full bg-bege-principal/15 px-3 py-1 font-semibold transition-colors hover:bg-bege-principal/25"
              >
                <LogOut size={14} /> Sair do modo cliente
              </button>
            </form>
          </div>
        )}

        {/* Topbar mobile com hambúrguer */}
        <div className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-borda bg-superficie px-4 py-3 lg:hidden">
          <button
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            className="rounded-md p-1.5 text-texto hover:bg-fundo"
          >
            <Menu size={22} />
          </button>
          <Logo variante="lockup" tom="escuro" height={24} />
        </div>

        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>

      {/* Suporte flutuante — assistente de IA (1ª linha) + escala p/ humano */}
      <SuporteWidget />
    </div>
  );
}
