-- =============================================================================
-- SEED: Lançamentos Contábeis — Maio/Junho 2026
-- Sprint 2 / Tarefa SP2-T02
-- Gerado por: BACK-END APOYA | 13/06/2026
-- Supabase: ajaqbdsalxfgrwpjbtbn
-- =============================================================================

SET search_path = public;
SET ROLE = authenticated;

-- Usar cliente existente para os lançamentos
DO $$ 
DECLARE
  v_client_id UUID := 'f41a9295-b7ea-4fe6-9c8e-e3aefd7f8d97'::UUID;
BEGIN

-- ── RECEITAS: maio/junho 2026
INSERT INTO public.apuracoes (
  client_id, competencia, regime, 
  receita_bruta, receita_servico, receita_comercio, aliquota_efetiva
) VALUES

-- Maio 2026: receita base R$ 125k
(v_client_id, '2026-05', 'accrual', 125000.00, 95000.00, 30000.00, 0.175),

-- Junho 2026: receita base R$ 138,5k (crescimento de 10.8%)
(v_client_id, '2026-06', 'accrual', 138500.00, 105000.00, 33500.00, 0.182)

ON CONFLICT (client_id, competencia) DO NOTHING;

RAISE NOTICE 'Seed completado: 2 apurações inseridas para competências maio/junho 2026';

END $$;
