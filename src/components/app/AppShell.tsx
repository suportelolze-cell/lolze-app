"use client";

import { useEffect, useState } from "react";
import { Menu, Eye, LogOut, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SuporteWidget } from "./SuporteWidget";
import { Logo } from "@/components/Logo";
import { sairImpersonacao } from "@/lib/admin/actions";

const CHAVE_RECOLHIDA = "lolze:sidebar-recolhida";

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
  // Recolher a barra lateral no desktop. Preferência do usuário, guardada no
  // navegador (por isso lê no efeito, evitando divergência com o SSR).
  const [recolhido, setRecolhido] = useState(false);

  useEffect(() => {
    try {
      setRecolhido(localStorage.getItem(CHAVE_RECOLHIDA) === "1");
    } catch {
      /* localStorage indisponível: segue com a barra visível */
    }
  }, []);

  function alternarRecolhido() {
    setRecolhido((v) => {
      const proximo = !v;
      try {
        localStorage.setItem(CHAVE_RECOLHIDA, proximo ? "1" : "0");
      } catch {
        /* ignora */
      }
      return proximo;
    });
  }

  return (
    <div className="min-h-screen bg-fundo">
      <Sidebar
        aberto={aberto}
        onClose={() => setAberto(false)}
        recolhido={recolhido}
        onRecolher={alternarRecolhido}
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

      {/* Botão flutuante para reabrir a barra quando recolhida (só desktop) */}
      {recolhido && (
        <button
          onClick={alternarRecolhido}
          aria-label="Mostrar menu lateral"
          className="no-print fixed left-3 top-3 z-40 hidden rounded-md border border-borda bg-superficie p-2 text-texto shadow-card transition-colors hover:bg-fundo lg:block"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      <div
        className={`print-reset-pad transition-[padding] duration-200 ${
          recolhido ? "lg:pl-0" : "lg:pl-64"
        }`}
      >
        {/* Banner de impersonação + topbar mobile empilhados num único sticky
            (senão ambos grudam em top-0 e o banner cobre o hambúrguer). */}
        <div className="no-print sticky top-0 z-20">
          {impersonating && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-marca px-4 py-2 text-sm text-bege-principal">
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
          <div className="flex items-center gap-3 border-b border-borda bg-superficie px-4 py-3 lg:hidden">
            <button
              onClick={() => setAberto(true)}
              aria-label="Abrir menu"
              className="rounded-md p-1.5 text-texto hover:bg-fundo"
            >
              <Menu size={22} />
            </button>
            <Logo variante="lockup" tom="escuro" height={24} />
          </div>
        </div>

        <div
          className={`w-full px-5 py-6 sm:px-8 sm:py-8 ${recolhido ? "lg:pl-14" : ""}`}
        >
          {children}
        </div>
      </div>

      {/* Suporte flutuante — assistente de IA (1ª linha) + escala p/ humano */}
      <SuporteWidget />
    </div>
  );
}
