/** Canais de venda com webhook de agente (n8n). Usado nas telas de admin. */
export const CANAIS_WEBHOOK = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram Direct" },
  { id: "facebook", label: "Facebook / Messenger" },
  { id: "telegram", label: "Telegram" },
  { id: "site", label: "Site / Webchat" },
] as const;

export type CanalWebhook = (typeof CANAIS_WEBHOOK)[number]["id"];
