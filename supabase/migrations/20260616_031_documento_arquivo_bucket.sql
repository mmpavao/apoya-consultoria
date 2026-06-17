-- 031: documento_arquivo.bucket
-- Unifica as duas telas de documentos (drive do Cliente × aba do Módulo) que
-- usavam buckets diferentes ('documentos-clientes' × 'documentos') sem registrar
-- qual. Decisão: o CLIENTE é a fonte canônica; o módulo é uma visão.
-- Esta migration é NÃO-DESTRUTIVA: só adiciona a coluna e registra onde cada
-- arquivo já está (não move nem apaga nada no storage).

alter table public.documento_arquivo
  add column if not exists bucket text not null default 'documentos';

-- Backfill por metadado: arquivos do drive do cliente foram gravados com
-- modulo NULL no bucket 'documentos-clientes'; uploads de módulo têm modulo
-- definido no bucket 'documentos'. (São os dois únicos produtores.)
update public.documento_arquivo
  set bucket = case when modulo is null then 'documentos-clientes' else 'documentos' end;
