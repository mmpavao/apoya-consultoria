-- =============================================================================
-- SEED: funcionarios — APOYA CONTABIL
-- Sprint 2 / Tarefa SP2-T01
-- Gerado por: BACK-END APOYA | 13/06/2026
-- Supabase: ajaqbdsalxfgrwpjbtbn
--
-- empresa_id: FK para clientes.id (usar cliente existente ou substituir pelo ID correto)
-- setor_slug: financeiro, dp, fiscal, tech, diretoria
-- Compatible com RLS has_setor(uid, setor_slug) — SEC-008
-- =============================================================================

SET search_path = public;

-- Substituir :EMPRESA_ID pelo UUID real do cliente principal
DO $$
DECLARE
  v_empresa_id UUID := 'f41a9295-b7ea-4fe6-9c8e-e3aefd7f8d97'::UUID;
BEGIN

INSERT INTO public.funcionarios (
  empresa_id, nome, cpf, pis,
  cargo, departamento, salario_base,
  data_admissao, tipo_contrato, jornada,
  banco, agencia, conta, tipo_conta,
  dependentes, status
) VALUES

-- ── FINANCEIRO
(v_empresa_id,'Ana Paula Ferreira Santos','123.456.789-01','12345678901','Analista Financeiro Senior','financeiro',7800.00,'2021-03-15','clt','44h','341','1234','56789-0','corrente',2,'ativo'),
(v_empresa_id,'Carlos Eduardo Lima','234.567.890-12','23456789012','Auxiliar Financeiro','financeiro',3200.00,'2023-07-01','clt','44h','033','5678','12345-6','corrente',0,'ativo'),
(v_empresa_id,'Mariana Costa Alves','345.678.901-23','34567890123','Tesoureira','financeiro',9500.00,'2019-01-10','clt','44h','104','2345','67890-1','corrente',3,'ativo'),

-- ── DEPARTAMENTO PESSOAL
(v_empresa_id,'Fernanda Rodrigues Melo','456.789.012-34','45678901234','Analista de RH Pleno','dp',5500.00,'2022-04-18','clt','44h','237','3456','78901-2','corrente',1,'ativo'),
(v_empresa_id,'Roberto Souza Pereira','567.890.123-45','56789012345','Assistente de DP','dp',2900.00,'2024-01-08','clt','44h','341','4567','89012-3','poupanca',0,'ativo'),
(v_empresa_id,'Juliana Nascimento Dias','678.901.234-56','67890123456','Coordenadora de DP','dp',8200.00,'2020-08-20','clt','44h','033','5678','90123-4','corrente',2,'ativo'),

-- ── FISCAL / CONTABIL
(v_empresa_id,'Paulo Henrique Martins','789.012.345-67','78901234567','Contador Senior','fiscal',10500.00,'2018-05-02','clt','44h','104','6789','01234-5','corrente',4,'ativo'),
(v_empresa_id,'Camila Araujo Carvalho','890.123.456-78','89012345678','Analista Fiscal','fiscal',6200.00,'2022-11-14','clt','44h','237','7890','12345-6','corrente',1,'ativo'),
(v_empresa_id,'Lucas Oliveira Barbosa','901.234.567-89','90123456789','Auxiliar Contabil','fiscal',2800.00,'2024-03-04','clt','44h','341','8901','23456-7','corrente',0,'ativo'),

-- ── TECNOLOGIA
(v_empresa_id,'Thiago Santos Cunha','012.345.678-90','01234567890','Desenvolvedor Full-Stack Senior','tech',14000.00,'2020-02-17','clt','44h','033','9012','34567-8','corrente',2,'ativo'),
(v_empresa_id,'Beatriz Lima Teixeira','111.222.333-44','11122233344','DevOps Engineer','tech',12500.00,'2021-09-06','clt','44h','104','1234','45678-9','corrente',0,'ativo'),

-- ── DIRETORIA
(v_empresa_id,'Marcelo Pavao Silva','222.333.444-55','22233344455','CEO e Fundador','diretoria',25000.00,'2015-01-01','clt','44h','237','2345','56789-0','corrente',3,'ativo'),
(v_empresa_id,'Patricia Gomes Freitas','333.444.555-66','33344455566','Diretora Operacional','diretoria',18000.00,'2017-06-12','clt','44h','341','3456','67890-1','corrente',2,'ativo')

ON CONFLICT (cpf) DO NOTHING;

RAISE NOTICE 'Seed concluido. COUNT: %', (SELECT COUNT(*) FROM public.funcionarios);
END $$;
