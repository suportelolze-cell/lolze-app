import { listarIdeias } from "@/lib/ideias/data";
import { MuralIdeias } from "@/components/ideias/MuralIdeias";

export const dynamic = "force-dynamic";

export default async function IdeiasPage() {
  const { ideias, souAdmin } = await listarIdeias();
  return <MuralIdeias ideiasIniciais={ideias} souAdmin={souAdmin} />;
}
