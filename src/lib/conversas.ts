// Tipos da Central de Atendimento (Tela 3). Dados vêm do Supabase (app_leads + app_mensagens).

import type { Temperatura, Origem } from "@/lib/leads";

export type Autor = "ia" | "lead" | "atendente";

export type MidiaTipo = "imagem" | "audio" | "documento";

export type Mensagem = {
  id: number;
  autor: Autor;
  texto: string;
  hora: string;
  midiaUrl?: string | null; // URL assinada da mídia original (atendente vê/ouve)
  midiaTipo?: MidiaTipo | null;
};

export type Comando = "ia" | "humano";

export type Conversa = {
  id: number;
  nome: string;
  telefone: string;
  origem: Origem;
  temperatura: Temperatura;
  comando: Comando;
  precisaHumano: boolean;
  diagnostico: string;
  mensagens: Mensagem[];
  atendenteId: string | null; // quem assumiu (perfil), null = IA / livre
  atendenteNome: string; // nome de quem assumiu ("" se livre)
};
