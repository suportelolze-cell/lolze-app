"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Search } from "lucide-react";
import { COLUNAS, type ColunaId, type Lead } from "@/lib/leads";
import { moverLead } from "@/lib/supabase/crm-actions";
import { Column } from "./Column";
import { LeadCard } from "./LeadCard";
import { LeadDetail } from "./LeadDetail";
import { PageHeader, Acento } from "@/components/ui";
import { descricaoSecao, type PlaybookCopy } from "@/lib/copy/secoes";

export function Board({
  initialLeads,
  podeGerir = false,
  playbook = "servico_local",
}: {
  initialLeads: Lead[];
  podeGerir?: boolean;
  playbook?: PlaybookCopy;
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState<Lead | null>(null); // card em arrasto
  const [perfil, setPerfil] = useState<Lead | null>(null); // painel aberto

  // Exigir 8px de movimento antes de iniciar drag → cliques nos botões funcionam
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone.includes(q) ||
        l.origem.toLowerCase().includes(q)
    );
  }, [leads, busca]);

  function onDragStart(e: DragStartEvent) {
    setAtivo(leads.find((l) => l.id === Number(e.active.id)) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setAtivo(null);
    const { active, over } = e;
    if (!over) return;
    const id = Number(active.id);
    const novaColuna = over.id as ColunaId;
    const atual = leads.find((l) => l.id === id);
    if (!atual || atual.coluna === novaColuna) return;
    // Atualização otimista + persistência no Supabase
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, coluna: novaColuna } : l))
    );
    moverLead(id, novaColuna).catch(() => {
      // rollback em caso de erro
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, coluna: atual.coluna } : l))
      );
    });
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100vh-8rem)]">
      {/* Cabeçalho */}
      <PageHeader
        titulo={
          <>
            Pipeline de <Acento>Vendas</Acento>
          </>
        }
        descricao={descricaoSecao("pipeline", playbook)}
        acao={
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar lead por nome, telefone ou tag..."
              className="w-full rounded-md border border-borda bg-superficie py-2.5 pl-9 pr-3 text-sm text-texto outline-none placeholder:text-texto-suave/70 focus:border-marca sm:w-72"
            />
          </div>
        }
      />

      {/* Quadro */}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {COLUNAS.map((col) => (
            <Column
              key={col.id}
              config={col}
              leads={filtrados.filter((l) => l.coluna === col.id)}
              onPerfil={setPerfil}
            />
          ))}
        </div>

        <DragOverlay>
          {ativo ? <LeadCard lead={ativo} arrastando /> : null}
        </DragOverlay>
      </DndContext>

      {/* Painel Raio-X */}
      <LeadDetail lead={perfil} onClose={() => setPerfil(null)} podeGerir={podeGerir} />
    </div>
  );
}
