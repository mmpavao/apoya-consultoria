-- Fix: coluna responsavel era NOT NULL sem DEFAULT, causando erro silencioso no cadastro
ALTER TABLE public.clientes 
  ALTER COLUMN responsavel SET DEFAULT 'APOYA';

-- Preencher registros existentes que ficaram null (caso existam)
UPDATE public.clientes 
  SET responsavel = 'APOYA' 
  WHERE responsavel IS NULL OR responsavel = '';
