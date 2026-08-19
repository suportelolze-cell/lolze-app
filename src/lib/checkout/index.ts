/**
 * Fachada da ingestão de checkout. A lógica pura (tipos, normalizadores e os
 * adapters Ticto/Hotmart/Kiwify) vive em ./core (auto-contido e testável). A
 * persistência (banco) fica em ./ingestao.
 */
export * from "./core";
