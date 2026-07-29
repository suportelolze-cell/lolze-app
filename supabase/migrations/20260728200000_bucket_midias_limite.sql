-- Teto de tamanho do bucket 'midias' (backstop contra upload abusivo de vários
-- GB via signed upload URL). 100 MiB = maior tipo legítimo (documento); o app
-- ainda aplica os limites por tipo (imagem 5MB, vídeo/áudio 16MB).
-- allowed_mime_types fica NULL de propósito: a mídia RECEBIDA (webhooks) sobe
-- com o content-type do provedor; travar por MIME descartaria entrada em silêncio.
-- Idempotente: só ajusta o bucket se ele existir.

update storage.buckets
set file_size_limit = 104857600 -- 100 MiB
where id = 'midias';
