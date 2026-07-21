"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sunrise,
  LayoutDashboard,
  KanbanSquare,
  MessagesSquare,
  CalendarDays,
  Workflow,
  Repeat,
  Radar,
  Users,
  Settings,
  LogOut,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { crmBrowser } from "@/lib/supabase/browser";

type Item = { href: string; label: string; icon: LucideIcon; gestorOnly?: boolean };
type Grupo = { titulo?: string; itens: Item[] };

const grupos: Grupo[] = [
  {
    itens: [
      { href: "/hoje", label: "Hoje", icon: Sunrise },
      { href: "/painel", label: "Visão Geral", icon: LayoutDashboard },
    ],
  },
  {
    titulo: "CRM",
    itens: [
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/atendimento", label: "Central de Atendimento", icon: MessagesSquare },
      { href: "/agenda", label: "Agenda Mágica", icon: CalendarDays },
      { href: "/contatos", label: "Contatos", icon: Users },
    ],
  },
  {
    titulo: "Crescimento",
    itens: [
      { href: "/funil", label: "Raio-X do Funil", icon: Workflow },
      { href: "/recorrencia", label: "Recorrência", icon: Repeat },
      { href: "/captacao", label: "Captação", icon: Radar, gestorOnly: true },
    ],
  },
  {
    // Universidade (conteúdo demonstrativo) e Ideias saíram do menu principal
    // até estarem prontos ponta a ponta (dossiê, seção 9).
    itens: [{ href: "/configuracoes", label: "Configurações", icon: Settings }],
  },
];

export function Sidebar({
  aberto = false,
  onClose = () => {},
  papel = "owner",
  impersonating = false,
}: {
  aberto?: boolean;
  onClose?: () => void;
  papel?: string;
  impersonating?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const ehSuper = papel === "superadmin";

  async function sair() {
    await crmBrowser.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-escuro-quente transition-transform duration-200 lg:translate-x-0 ${
        aberto ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo */}
      <div className="flex h-20 items-center px-6">
        <Logo variante="lockup" tom="branco" height={30} />
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {ehSuper && (
          <Link
            href="/admin"
            onClick={onClose}
            className={`mb-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors ${
              pathname.startsWith("/admin")
                ? "bg-marca text-bege-principal"
                : "bg-white/5 text-bege-principal/80 hover:bg-white/10 hover:text-bege-principal"
            }`}
          >
            <Shield size={18} strokeWidth={2} />
            <span>Painel do Admin</span>
          </Link>
        )}
        {grupos.map((grupo, gi) => {
          const visiveis = grupo.itens.filter((it) => !it.gestorOnly || ehSuper || papel === "owner");
          if (visiveis.length === 0) return null;
          return (
            <div key={gi}>
              {grupo.titulo && (
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-bege-principal/30">
                  {grupo.titulo}
                </p>
              )}
              <div className="space-y-0.5">
                {visiveis.map(({ href, label, icon: Icon }) => {
                  const ativo = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                        ativo
                          ? "bg-marca text-bege-principal"
                          : "text-bege-principal/55 hover:bg-white/5 hover:text-bege-principal"
                      }`}
                    >
                      <Icon size={18} strokeWidth={2} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Rodapé do menu */}
      <div className="space-y-3 px-3 py-5">
        <button
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-bege-principal/55 transition-colors hover:bg-white/5 hover:text-bege-principal"
        >
          <LogOut size={18} /> Sair
        </button>
        <p className="px-3 text-[11px] leading-relaxed text-bege-principal/35">
          Sistema Lolze de Escala
        </p>
      </div>
    </aside>
  );
}
