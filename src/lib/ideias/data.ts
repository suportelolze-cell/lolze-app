import { getCrmAdmin } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/tenant";

export type StatusIdeia = "analise" | "aprovado" | "execucao" | "entregue" | "recusado";

export type Ideia = {
  id: string;
  titulo: string;
  descricao: string;
  status: StatusIdeia;
  autorNome: string;
  minha: boolean;
  curtidas: number;
  euCurti: boolean;
  comentarios: number;
  createdAt: string;
};

export type MuralDados = {
  ideias: Ideia[];
  souAdmin: boolean;
  logado: boolean;
};

/**
 * Mural de ideias — quadro GLOBAL do produto (todo cliente vê as mesmas ideias).
 * Leitura via service-role (getCrmAdmin) com a sessão só para marcar "minha"/"euCurti".
 */
export async function listarIdeias(): Promise<MuralDados> {
  const s = await getSessao();
  const admin = getCrmAdmin();

  const { data: rows } = await admin
    .from("app_ideias")
    .select("id,titulo,descricao,status,autor_id,autor_nome,created_at")
    .order("created_at", { ascending: false });

  const base = (rows ?? []) as Array<{
    id: string;
    titulo: string;
    descricao: string | null;
    status: string | null;
    autor_id: string | null;
    autor_nome: string | null;
    created_at: string;
  }>;

  const ids = base.map((r) => r.id);
  const curtidas = new Map<string, number>();
  const euCurti = new Set<string>();
  const comentarios = new Map<string, number>();

  if (ids.length) {
    const [likesRes, comsRes] = await Promise.all([
      admin.from("app_ideia_likes").select("ideia_id,user_id").in("ideia_id", ids),
      admin.from("app_ideia_comentarios").select("ideia_id").in("ideia_id", ids),
    ]);
    for (const l of (likesRes.data ?? []) as Array<{ ideia_id: string; user_id: string }>) {
      curtidas.set(l.ideia_id, (curtidas.get(l.ideia_id) ?? 0) + 1);
      if (s.userId && l.user_id === s.userId) euCurti.add(l.ideia_id);
    }
    for (const c of (comsRes.data ?? []) as Array<{ ideia_id: string }>) {
      comentarios.set(c.ideia_id, (comentarios.get(c.ideia_id) ?? 0) + 1);
    }
  }

  const ideias: Ideia[] = base.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao ?? "",
    status: (r.status ?? "analise") as StatusIdeia,
    autorNome: (r.autor_nome ?? "").trim() || "Cliente Lolze",
    minha: !!s.userId && r.autor_id === s.userId,
    curtidas: curtidas.get(r.id) ?? 0,
    euCurti: euCurti.has(r.id),
    comentarios: comentarios.get(r.id) ?? 0,
    createdAt: r.created_at,
  }));

  // Mais votadas primeiro; empate pela mais recente.
  ideias.sort((a, b) => b.curtidas - a.curtidas || (a.createdAt < b.createdAt ? 1 : -1));

  return { ideias, souAdmin: s.papel === "superadmin", logado: !!s.userId };
}
