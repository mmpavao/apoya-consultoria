export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      apuracoes_mensais: {
        Row: {
          aliquota_efetiva: number | null
          checklist: Json | null
          cofins_a_pagar: number | null
          cofins_credito: number | null
          cofins_debito: number | null
          created_at: string | null
          created_by: string | null
          csll_base: number | null
          csll_pago_em: string | null
          csll_valor: number | null
          das_codigo_barras: string | null
          das_comprovante_url: string | null
          das_linha_digitavel: string | null
          das_pago_em: string | null
          das_valor: number | null
          das_vencimento: string | null
          empresa_id: string
          icms_a_pagar: number | null
          icms_credito: number | null
          icms_debito: number | null
          icms_pago_em: string | null
          icms_saldo_credor: number | null
          id: string
          irpj_base: number | null
          irpj_pago_em: string | null
          irpj_valor: number | null
          iss_a_pagar: number | null
          iss_aliquota: number | null
          iss_base: number | null
          iss_pago_em: string | null
          mes_referencia: string
          observacoes: string | null
          pgdas_recibo: string | null
          pgdas_transmitido_em: string | null
          pis_a_pagar: number | null
          pis_credito: number | null
          pis_debito: number | null
          rbt12: number | null
          receita_bruta: number | null
          receita_bruta_comercio: number | null
          receita_bruta_industria: number | null
          receita_bruta_servico: number | null
          regime: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          aliquota_efetiva?: number | null
          checklist?: Json | null
          cofins_a_pagar?: number | null
          cofins_credito?: number | null
          cofins_debito?: number | null
          created_at?: string | null
          created_by?: string | null
          csll_base?: number | null
          csll_pago_em?: string | null
          csll_valor?: number | null
          das_codigo_barras?: string | null
          das_comprovante_url?: string | null
          das_linha_digitavel?: string | null
          das_pago_em?: string | null
          das_valor?: number | null
          das_vencimento?: string | null
          empresa_id: string
          icms_a_pagar?: number | null
          icms_credito?: number | null
          icms_debito?: number | null
          icms_pago_em?: string | null
          icms_saldo_credor?: number | null
          id?: string
          irpj_base?: number | null
          irpj_pago_em?: string | null
          irpj_valor?: number | null
          iss_a_pagar?: number | null
          iss_aliquota?: number | null
          iss_base?: number | null
          iss_pago_em?: string | null
          mes_referencia: string
          observacoes?: string | null
          pgdas_recibo?: string | null
          pgdas_transmitido_em?: string | null
          pis_a_pagar?: number | null
          pis_credito?: number | null
          pis_debito?: number | null
          rbt12?: number | null
          receita_bruta?: number | null
          receita_bruta_comercio?: number | null
          receita_bruta_industria?: number | null
          receita_bruta_servico?: number | null
          regime: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          aliquota_efetiva?: number | null
          checklist?: Json | null
          cofins_a_pagar?: number | null
          cofins_credito?: number | null
          cofins_debito?: number | null
          created_at?: string | null
          created_by?: string | null
          csll_base?: number | null
          csll_pago_em?: string | null
          csll_valor?: number | null
          das_codigo_barras?: string | null
          das_comprovante_url?: string | null
          das_linha_digitavel?: string | null
          das_pago_em?: string | null
          das_valor?: number | null
          das_vencimento?: string | null
          empresa_id?: string
          icms_a_pagar?: number | null
          icms_credito?: number | null
          icms_debito?: number | null
          icms_pago_em?: string | null
          icms_saldo_credor?: number | null
          id?: string
          irpj_base?: number | null
          irpj_pago_em?: string | null
          irpj_valor?: number | null
          iss_a_pagar?: number | null
          iss_aliquota?: number | null
          iss_base?: number | null
          iss_pago_em?: string | null
          mes_referencia?: string
          observacoes?: string | null
          pgdas_recibo?: string | null
          pgdas_transmitido_em?: string | null
          pis_a_pagar?: number | null
          pis_credito?: number | null
          pis_debito?: number | null
          rbt12?: number | null
          receita_bruta?: number | null
          receita_bruta_comercio?: number | null
          receita_bruta_industria?: number | null
          receita_bruta_servico?: number | null
          regime?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apuracoes_mensais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          dados: Json | null
          entidade: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados?: Json | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      calendario_fiscal: {
        Row: {
          ativo: boolean
          codigo: string
          competencia_mes: number | null
          descricao: string | null
          dia_vencimento: number | null
          id: string
          mes_vencimento: number | null
          nome: string
          observacoes: string | null
          periodicidade: string
          regime: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          competencia_mes?: number | null
          descricao?: string | null
          dia_vencimento?: number | null
          id?: string
          mes_vencimento?: number | null
          nome: string
          observacoes?: string | null
          periodicidade?: string
          regime?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          competencia_mes?: number | null
          descricao?: string | null
          dia_vencimento?: number | null
          id?: string
          mes_vencimento?: number | null
          nome?: string
          observacoes?: string | null
          periodicidade?: string
          regime?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      clicksign_evento: {
        Row: {
          contrato_id: string | null
          envelope_id: string
          event_data: Json | null
          event_name: string
          id: string
          processed_at: string | null
          raw_payload: Json | null
          signer_email: string | null
        }
        Insert: {
          contrato_id?: string | null
          envelope_id: string
          event_data?: Json | null
          event_name: string
          id?: string
          processed_at?: string | null
          raw_payload?: Json | null
          signer_email?: string | null
        }
        Update: {
          contrato_id?: string | null
          envelope_id?: string
          event_data?: Json | null
          event_name?: string
          id?: string
          processed_at?: string | null
          raw_payload?: Json | null
          signer_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicksign_evento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_certificado: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          has_procuracao: boolean
          id: string
          focus_cert_ref: string | null
          focus_cert_enviado_em: string | null
          pfx_cnpj: string | null
          pfx_encrypted: string | null
          pfx_nome_razao: string | null
          pfx_senha_encrypted: string | null
          pfx_serial: string | null
          pfx_validade: string | null
          procuracao_validade: string | null
          procuracao_verificada_em: string | null
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          has_procuracao?: boolean
          id?: string
          focus_cert_ref?: string | null
          focus_cert_enviado_em?: string | null
          pfx_cnpj?: string | null
          pfx_encrypted?: string | null
          pfx_nome_razao?: string | null
          pfx_senha_encrypted?: string | null
          pfx_serial?: string | null
          pfx_validade?: string | null
          procuracao_validade?: string | null
          procuracao_verificada_em?: string | null
          tipo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          has_procuracao?: boolean
          id?: string
          focus_cert_ref?: string | null
          focus_cert_enviado_em?: string | null
          pfx_cnpj?: string | null
          pfx_encrypted?: string | null
          pfx_nome_razao?: string | null
          pfx_senha_encrypted?: string | null
          pfx_serial?: string | null
          pfx_validade?: string | null
          procuracao_validade?: string | null
          procuracao_verificada_em?: string | null
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_certificado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_servico: {
        Row: {
          catalogo_id: string
          cliente_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          desconto: number
          id: string
          nome_servico: string
          observacoes: string | null
          periodicidade: string
          status: string
          updated_at: string
          valor_contratado: number
          valor_final: number | null
        }
        Insert: {
          catalogo_id: string
          cliente_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          desconto?: number
          id?: string
          nome_servico: string
          observacoes?: string | null
          periodicidade?: string
          status?: string
          updated_at?: string
          valor_contratado: number
          valor_final?: number | null
        }
        Update: {
          catalogo_id?: string
          cliente_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          desconto?: number
          id?: string
          nome_servico?: string
          observacoes?: string | null
          periodicidade?: string
          status?: string
          updated_at?: string
          valor_contratado?: number
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_servico_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "servico_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_socio: {
        Row: {
          capital_integralizado: number | null
          capital_subscrito: number | null
          cliente_id: string
          cnpj_cpf_socio: string | null
          codigo_qualificacao: number | null
          cpf: string | null
          cpf_representante: string | null
          created_at: string
          created_by: string | null
          data_entrada: string | null
          data_saida: string | null
          email: string | null
          id: string
          is_administrador: boolean
          is_ativo: boolean
          nome: string
          nome_representante: string | null
          percentual: number | null
          qualificacao: string | null
          qualificacao_representante: string | null
          telefone: string | null
          tipo_socio: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          capital_integralizado?: number | null
          capital_subscrito?: number | null
          cliente_id: string
          cnpj_cpf_socio?: string | null
          codigo_qualificacao?: number | null
          cpf?: string | null
          cpf_representante?: string | null
          created_at?: string
          created_by?: string | null
          data_entrada?: string | null
          data_saida?: string | null
          email?: string | null
          id?: string
          is_administrador?: boolean
          is_ativo?: boolean
          nome: string
          nome_representante?: string | null
          percentual?: number | null
          qualificacao?: string | null
          qualificacao_representante?: string | null
          telefone?: string | null
          tipo_socio?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          capital_integralizado?: number | null
          capital_subscrito?: number | null
          cliente_id?: string
          cnpj_cpf_socio?: string | null
          codigo_qualificacao?: number | null
          cpf?: string | null
          cpf_representante?: string | null
          created_at?: string
          created_by?: string | null
          data_entrada?: string | null
          data_saida?: string | null
          email?: string | null
          id?: string
          is_administrador?: boolean
          is_ativo?: boolean
          nome?: string
          nome_representante?: string | null
          percentual?: number | null
          qualificacao?: string | null
          qualificacao_representante?: string | null
          telefone?: string | null
          tipo_socio?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_socio_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          aliquota_iss: number | null
          asaas_customer_id: string | null
          atividade_principal: string | null
          bairro: string | null
          cep: string | null
          cnpj: string
          codigo_municipio_ibge: string | null
          codigo_servico_nfse: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_inadimplencia: string | null
          data_suspensao: string | null
          dia_vencimento: number | null
          email: string | null
          endereco: Json
          forma_pagamento: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          motivo_suspensao: string | null
          municipio: string | null
          focus_ambiente: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          razao_social: string
          regime: string
          regime_hibrido: boolean
          responsavel: string
          responsavel_id: string | null
          status: string
          telefone: string | null
          tem_certificado: boolean
          tem_empregados: boolean
          tem_incentivo_fiscal: boolean
          tem_procuracao: boolean
          tier: string | null
          uf: string | null
          updated_at: string
          valor_honorario: number | null
          whatsapp: string | null
        }
        Insert: {
          aliquota_iss?: number | null
          asaas_customer_id?: string | null
          atividade_principal?: string | null
          bairro?: string | null
          cep?: string | null
          cnpj: string
          codigo_municipio_ibge?: string | null
          codigo_servico_nfse?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_inadimplencia?: string | null
          data_suspensao?: string | null
          dia_vencimento?: number | null
          email?: string | null
          endereco?: Json
          forma_pagamento?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          motivo_suspensao?: string | null
          municipio?: string | null
          focus_ambiente?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social: string
          regime: string
          regime_hibrido?: boolean
          responsavel: string
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          tem_certificado?: boolean
          tem_empregados?: boolean
          tem_incentivo_fiscal?: boolean
          tem_procuracao?: boolean
          tier?: string | null
          uf?: string | null
          updated_at?: string
          valor_honorario?: number | null
          whatsapp?: string | null
        }
        Update: {
          aliquota_iss?: number | null
          asaas_customer_id?: string | null
          atividade_principal?: string | null
          bairro?: string | null
          cep?: string | null
          cnpj?: string
          codigo_municipio_ibge?: string | null
          codigo_servico_nfse?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_inadimplencia?: string | null
          data_suspensao?: string | null
          dia_vencimento?: number | null
          email?: string | null
          endereco?: Json
          forma_pagamento?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          motivo_suspensao?: string | null
          municipio?: string | null
          focus_ambiente?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social?: string
          regime?: string
          regime_hibrido?: boolean
          responsavel?: string
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          tem_certificado?: boolean
          tem_empregados?: boolean
          tem_incentivo_fiscal?: boolean
          tem_procuracao?: boolean
          tier?: string | null
          uf?: string | null
          updated_at?: string
          valor_honorario?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          asaas_id: string | null
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          boleto_url: string | null
          cancelado_em: string | null
          cliente_id: string
          cliente_nome: string
          cnpj: string
          codigo_barras: string | null
          competencia: string
          created_at: string
          descricao: string
          dias_atraso: number
          forma: string
          id: string
          link_pagamento: string | null
          pago_em: string | null
          pdf_url: string | null
          pix_copia_cola: string | null
          regua_stage: string
          regua_stage_nome: string | null
          status: string
          ultimo_contato_em: string | null
          ultimo_envio_whatsapp: string | null
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          asaas_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          boleto_url?: string | null
          cancelado_em?: string | null
          cliente_id: string
          cliente_nome: string
          cnpj: string
          codigo_barras?: string | null
          competencia: string
          created_at?: string
          descricao: string
          dias_atraso?: number
          forma: string
          id?: string
          link_pagamento?: string | null
          pago_em?: string | null
          pdf_url?: string | null
          pix_copia_cola?: string | null
          regua_stage?: string
          regua_stage_nome?: string | null
          status?: string
          ultimo_contato_em?: string | null
          ultimo_envio_whatsapp?: string | null
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          asaas_id?: string | null
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          boleto_url?: string | null
          cancelado_em?: string | null
          cliente_id?: string
          cliente_nome?: string
          cnpj?: string
          codigo_barras?: string | null
          competencia?: string
          created_at?: string
          descricao?: string
          dias_atraso?: number
          forma?: string
          id?: string
          link_pagamento?: string | null
          pago_em?: string | null
          pdf_url?: string | null
          pix_copia_cola?: string | null
          regua_stage?: string
          regua_stage_nome?: string | null
          status?: string
          ultimo_contato_em?: string | null
          ultimo_envio_whatsapp?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_cliente: {
        Row: {
          assinado_em: string | null
          cancelado_em: string | null
          clausulas: Json
          clicksign_assinado_em: string | null
          clicksign_deadline_days: number | null
          clicksign_document_id: string | null
          clicksign_envelope_id: string | null
          clicksign_enviado_em: string | null
          clicksign_events: Json
          clicksign_key: string | null
          clicksign_notify_email: boolean | null
          clicksign_notify_whatsapp: boolean | null
          clicksign_pdf_url: string | null
          clicksign_remind_days: number | null
          clicksign_sign_url: string | null
          clicksign_signed_pdf: string | null
          clicksign_signer_id: string | null
          clicksign_status: string | null
          clicksign_url: string | null
          cliente_id: string
          corpo_html: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          deadline_days: number
          enviado_em: string | null
          id: string
          notificacao_canal: string
          numero: string | null
          observacoes: string | null
          servicos_ids: string[]
          signatario_email: string | null
          signatario_nome: string | null
          signatario_whatsapp: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          assinado_em?: string | null
          cancelado_em?: string | null
          clausulas?: Json
          clicksign_assinado_em?: string | null
          clicksign_deadline_days?: number | null
          clicksign_document_id?: string | null
          clicksign_envelope_id?: string | null
          clicksign_enviado_em?: string | null
          clicksign_events?: Json
          clicksign_key?: string | null
          clicksign_notify_email?: boolean | null
          clicksign_notify_whatsapp?: boolean | null
          clicksign_pdf_url?: string | null
          clicksign_remind_days?: number | null
          clicksign_sign_url?: string | null
          clicksign_signed_pdf?: string | null
          clicksign_signer_id?: string | null
          clicksign_status?: string | null
          clicksign_url?: string | null
          cliente_id: string
          corpo_html?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          deadline_days?: number
          enviado_em?: string | null
          id?: string
          notificacao_canal?: string
          numero?: string | null
          observacoes?: string | null
          servicos_ids?: string[]
          signatario_email?: string | null
          signatario_nome?: string | null
          signatario_whatsapp?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          assinado_em?: string | null
          cancelado_em?: string | null
          clausulas?: Json
          clicksign_assinado_em?: string | null
          clicksign_deadline_days?: number | null
          clicksign_document_id?: string | null
          clicksign_envelope_id?: string | null
          clicksign_enviado_em?: string | null
          clicksign_events?: Json
          clicksign_key?: string | null
          clicksign_notify_email?: boolean | null
          clicksign_notify_whatsapp?: boolean | null
          clicksign_pdf_url?: string | null
          clicksign_remind_days?: number | null
          clicksign_sign_url?: string | null
          clicksign_signed_pdf?: string | null
          clicksign_signer_id?: string | null
          clicksign_status?: string | null
          clicksign_url?: string | null
          cliente_id?: string
          corpo_html?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          deadline_days?: number
          enviado_em?: string | null
          id?: string
          notificacao_canal?: string
          numero?: string | null
          observacoes?: string | null
          servicos_ids?: string[]
          signatario_email?: string | null
          signatario_nome?: string | null
          signatario_whatsapp?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          cancelado_em: string | null
          criado_em: string
          criado_por: string | null
          email: string
          expira_em: string
          id: string
          mensagem: string | null
          role: string
          setores_ids: string[] | null
          token: string
          usado_em: string | null
        }
        Insert: {
          cancelado_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email: string
          expira_em?: string
          id?: string
          mensagem?: string | null
          role?: string
          setores_ids?: string[] | null
          token: string
          usado_em?: string | null
        }
        Update: {
          cancelado_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string
          expira_em?: string
          id?: string
          mensagem?: string | null
          role?: string
          setores_ids?: string[] | null
          token?: string
          usado_em?: string | null
        }
        Relationships: []
      }
      das_guias: {
        Row: {
          cliente_id: string
          cliente_nome: string
          cnpj: string
          codigo_barras: string | null
          competencia: string
          created_at: string
          enviado_wa_em: string | null
          enviado_whatsapp_em: string | null
          erro: string | null
          gerado_em: string | null
          id: string
          pago_em: string | null
          pdf_url: string | null
          regime: string
          status: string
          tentativas: number
          tipo: string
          ultimo_erro: string | null
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          cliente_id: string
          cliente_nome: string
          cnpj: string
          codigo_barras?: string | null
          competencia: string
          created_at?: string
          enviado_wa_em?: string | null
          enviado_whatsapp_em?: string | null
          erro?: string | null
          gerado_em?: string | null
          id?: string
          pago_em?: string | null
          pdf_url?: string | null
          regime: string
          status?: string
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          cliente_id?: string
          cliente_nome?: string
          cnpj?: string
          codigo_barras?: string | null
          competencia?: string
          created_at?: string
          enviado_wa_em?: string | null
          enviado_whatsapp_em?: string | null
          erro?: string | null
          gerado_em?: string | null
          id?: string
          pago_em?: string | null
          pdf_url?: string | null
          regime?: string
          status?: string
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "das_guias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_arquivo: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          pasta_id: string
          storage_path: string
          storage_url: string | null
          tags: string[] | null
          tamanho_bytes: number | null
          tipo_mime: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          pasta_id: string
          storage_path: string
          storage_url?: string | null
          tags?: string[] | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          pasta_id?: string
          storage_path?: string
          storage_url?: string | null
          tags?: string[] | null
          tamanho_bytes?: number | null
          tipo_mime?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_arquivo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_arquivo_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "documento_pasta"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_pasta: {
        Row: {
          cliente_id: string
          cor: string
          created_at: string
          descricao: string | null
          icone: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          cor?: string
          created_at?: string
          descricao?: string | null
          icone?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          cor?: string
          created_at?: string
          descricao?: string | null
          icone?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_pasta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_fiscais: {
        Row: {
          cfop_principal: string | null
          chave_acesso: string | null
          classificado_por: string | null
          confianca: string | null
          conta_contabil_confirmada: string | null
          conta_contabil_sugerida: string | null
          created_at: string | null
          created_by: string | null
          data_emissao: string | null
          data_entrada_saida: string | null
          destinatario_cnpj: string | null
          destinatario_razao: string | null
          emitente_cnpj: string | null
          emitente_razao: string | null
          empresa_id: string
          gera_credito_icms: boolean | null
          gera_credito_pis_cofins: boolean | null
          id: string
          mes_referencia: string | null
          modelo: string | null
          natureza_fiscal: string | null
          natureza_operacao: string | null
          numero: string | null
          observacoes: string | null
          pdf_url: string | null
          serie: string | null
          status: string | null
          tipo: string
          updated_at: string | null
          valor_cbs: number | null
          valor_cofins: number | null
          valor_credito_cofins: number | null
          valor_credito_icms: number | null
          valor_credito_pis: number | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_ibs: number | null
          valor_icms: number | null
          valor_ipi: number | null
          valor_iss: number | null
          valor_pis: number | null
          valor_produtos: number | null
          valor_seguro: number | null
          valor_total: number | null
          xml_url: string | null
        }
        Insert: {
          cfop_principal?: string | null
          chave_acesso?: string | null
          classificado_por?: string | null
          confianca?: string | null
          conta_contabil_confirmada?: string | null
          conta_contabil_sugerida?: string | null
          created_at?: string | null
          created_by?: string | null
          data_emissao?: string | null
          data_entrada_saida?: string | null
          destinatario_cnpj?: string | null
          destinatario_razao?: string | null
          emitente_cnpj?: string | null
          emitente_razao?: string | null
          empresa_id: string
          gera_credito_icms?: boolean | null
          gera_credito_pis_cofins?: boolean | null
          id?: string
          mes_referencia?: string | null
          modelo?: string | null
          natureza_fiscal?: string | null
          natureza_operacao?: string | null
          numero?: string | null
          observacoes?: string | null
          pdf_url?: string | null
          serie?: string | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          valor_cbs?: number | null
          valor_cofins?: number | null
          valor_credito_cofins?: number | null
          valor_credito_icms?: number | null
          valor_credito_pis?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_ibs?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_seguro?: number | null
          valor_total?: number | null
          xml_url?: string | null
        }
        Update: {
          cfop_principal?: string | null
          chave_acesso?: string | null
          classificado_por?: string | null
          confianca?: string | null
          conta_contabil_confirmada?: string | null
          conta_contabil_sugerida?: string | null
          created_at?: string | null
          created_by?: string | null
          data_emissao?: string | null
          data_entrada_saida?: string | null
          destinatario_cnpj?: string | null
          destinatario_razao?: string | null
          emitente_cnpj?: string | null
          emitente_razao?: string | null
          empresa_id?: string
          gera_credito_icms?: boolean | null
          gera_credito_pis_cofins?: boolean | null
          id?: string
          mes_referencia?: string | null
          modelo?: string | null
          natureza_fiscal?: string | null
          natureza_operacao?: string | null
          numero?: string | null
          observacoes?: string | null
          pdf_url?: string | null
          serie?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          valor_cbs?: number | null
          valor_cofins?: number | null
          valor_credito_cofins?: number | null
          valor_credito_icms?: number | null
          valor_credito_pis?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_ibs?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_produtos?: number | null
          valor_seguro?: number | null
          valor_total?: number | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_fiscais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      escritorio_config: {
        Row: {
          asaas_api_key: string | null
          cnpj: string
          crc: string | null
          created_at: string
          dia_cobranca: number
          dias_suspensao: number
          email: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
          logotipo_url: string | null
          focusnfe_api_token: string | null
          
          focus_ambiente: string | null
          nome_fantasia: string
          razao_social: string
          serpro_token: string | null
          telefone: string | null
          template_wa_cobranca: string | null
          template_wa_das: string | null
          template_wa_nfse: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          asaas_api_key?: string | null
          cnpj?: string
          crc?: string | null
          created_at?: string
          dia_cobranca?: number
          dias_suspensao?: number
          email?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          logotipo_url?: string | null
          focusnfe_api_token?: string | null
          
          focus_ambiente?: string | null
          nome_fantasia?: string
          razao_social?: string
          serpro_token?: string | null
          telefone?: string | null
          template_wa_cobranca?: string | null
          template_wa_das?: string | null
          template_wa_nfse?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          asaas_api_key?: string | null
          cnpj?: string
          crc?: string | null
          created_at?: string
          dia_cobranca?: number
          dias_suspensao?: number
          email?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          logotipo_url?: string | null
          focusnfe_api_token?: string | null
          
          focus_ambiente?: string | null
          nome_fantasia?: string
          razao_social?: string
          serpro_token?: string | null
          telefone?: string | null
          template_wa_cobranca?: string | null
          template_wa_das?: string | null
          template_wa_nfse?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      extrato_bancario: {
        Row: {
          conciliado_em: string | null
          conciliado_por: string | null
          confianca: string | null
          conta_sugerida: string | null
          created_at: string | null
          data_linha: string
          empresa_id: string
          historico_banco: string
          historico_classificado: string | null
          id: string
          lancamento_id: string | null
          mes_referencia: string
          saldo_apos: number | null
          status: string | null
          tipo: string
          valor: number
        }
        Insert: {
          conciliado_em?: string | null
          conciliado_por?: string | null
          confianca?: string | null
          conta_sugerida?: string | null
          created_at?: string | null
          data_linha: string
          empresa_id: string
          historico_banco: string
          historico_classificado?: string | null
          id?: string
          lancamento_id?: string | null
          mes_referencia: string
          saldo_apos?: number | null
          status?: string | null
          tipo: string
          valor: number
        }
        Update: {
          conciliado_em?: string | null
          conciliado_por?: string | null
          confianca?: string | null
          conta_sugerida?: string | null
          created_at?: string | null
          data_linha?: string
          empresa_id?: string
          historico_banco?: string
          historico_classificado?: string | null
          id?: string
          lancamento_id?: string | null
          mes_referencia?: string
          saldo_apos?: number | null
          status?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extrato_bancario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extrato_bancario_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_config: {
        Row: {
          ativa: boolean
          config: Json
          id: string
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativa?: boolean
          config?: Json
          id?: string
          tipo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativa?: boolean
          config?: Json
          id?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lancamentos_contabeis: {
        Row: {
          centro_custo: string | null
          conta_credito: string
          conta_debito: string
          created_at: string | null
          created_by: string | null
          data_competencia: string
          data_lancamento: string
          documento_id: string | null
          empresa_id: string
          historico: string
          id: string
          lancamento_estorno_id: string | null
          mes_referencia: string
          periodo_fechado: boolean | null
          status: string | null
          tipo: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          centro_custo?: string | null
          conta_credito: string
          conta_debito: string
          created_at?: string | null
          created_by?: string | null
          data_competencia: string
          data_lancamento?: string
          documento_id?: string | null
          empresa_id: string
          historico: string
          id?: string
          lancamento_estorno_id?: string | null
          mes_referencia: string
          periodo_fechado?: boolean | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          centro_custo?: string | null
          conta_credito?: string
          conta_debito?: string
          created_at?: string | null
          created_by?: string | null
          data_competencia?: string
          data_lancamento?: string
          documento_id?: string | null
          empresa_id?: string
          historico?: string
          id?: string
          lancamento_estorno_id?: string | null
          mes_referencia?: string
          periodo_fechado?: boolean | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_contabeis_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_lancamento_estorno_id_fkey"
            columns: ["lancamento_estorno_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagem_whatsapp: {
        Row: {
          agente_id: string | null
          agente_nome: string | null
          arquivo_nome: string | null
          arquivo_url: string | null
          cliente_id: string | null
          conteudo: string | null
          conversa_id: string | null
          created_at: string
          departamento: string | null
          direcao: string
          eh_automatica: boolean
          evolution_id: string | null
          id: string
          instance_id: string | null
          lida_em: string | null
          mime_type: string | null
          reaction: string | null
          reaction_to: string | null
          reply_to: string | null
          status: string
          telefone: string
          tipo: string
        }
        Insert: {
          agente_id?: string | null
          agente_nome?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          cliente_id?: string | null
          conteudo?: string | null
          conversa_id?: string | null
          created_at?: string
          departamento?: string | null
          direcao: string
          eh_automatica?: boolean
          evolution_id?: string | null
          id?: string
          instance_id?: string | null
          lida_em?: string | null
          mime_type?: string | null
          reaction?: string | null
          reaction_to?: string | null
          reply_to?: string | null
          status?: string
          telefone: string
          tipo?: string
        }
        Update: {
          agente_id?: string | null
          agente_nome?: string | null
          arquivo_nome?: string | null
          arquivo_url?: string | null
          cliente_id?: string | null
          conteudo?: string | null
          conversa_id?: string | null
          created_at?: string
          departamento?: string | null
          direcao?: string
          eh_automatica?: boolean
          evolution_id?: string | null
          id?: string
          instance_id?: string | null
          lida_em?: string | null
          mime_type?: string | null
          reaction?: string | null
          reaction_to?: string | null
          reply_to?: string | null
          status?: string
          telefone?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_whatsapp_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagem_whatsapp_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "wa_conversa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagem_whatsapp_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instance"
            referencedColumns: ["id"]
          },
        ]
      }
      nfse_emitida: {
        Row: {
          aliquota_iss: number | null
          cliente_id: string
          codigo_servico: string | null
          codigo_verificacao: string | null
          competencia: string | null
          created_at: string
          created_by: string | null
          data_cancelamento: string | null
          data_emissao: string | null
          descricao_servico: string | null
          erro_msg: string | null
          id: string
          issretido: boolean | null
          focus_ref: string | null
          numero: string | null
          pdf_storage_path: string | null
          pdf_url: string | null
          status: string
          tomador_cnpj_cpf: string | null
          tomador_email: string | null
          tomador_municipio: string | null
          tomador_nome: string | null
          tomador_uf: string | null
          updated_at: string
          valor_deducoes: number | null
          valor_iss: number | null
          valor_servico: number | null
          xml_content: string | null
        }
        Insert: {
          aliquota_iss?: number | null
          cliente_id: string
          codigo_servico?: string | null
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          descricao_servico?: string | null
          erro_msg?: string | null
          id?: string
          issretido?: boolean | null
          focus_ref?: string | null
          numero?: string | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          status?: string
          tomador_cnpj_cpf?: string | null
          tomador_email?: string | null
          tomador_municipio?: string | null
          tomador_nome?: string | null
          tomador_uf?: string | null
          updated_at?: string
          valor_deducoes?: number | null
          valor_iss?: number | null
          valor_servico?: number | null
          xml_content?: string | null
        }
        Update: {
          aliquota_iss?: number | null
          cliente_id?: string
          codigo_servico?: string | null
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          descricao_servico?: string | null
          erro_msg?: string | null
          id?: string
          issretido?: boolean | null
          focus_ref?: string | null
          numero?: string | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          status?: string
          tomador_cnpj_cpf?: string | null
          tomador_email?: string | null
          tomador_municipio?: string | null
          tomador_nome?: string | null
          tomador_uf?: string | null
          updated_at?: string
          valor_deducoes?: number | null
          valor_iss?: number | null
          valor_servico?: number | null
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfse_emitida_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nfse_notas: {
        Row: {
          aliquota_cbs: number | null
          aliquota_ibs: number | null
          aliquota_iss: number
          cancelada_em: string | null
          cliente_id: string
          cliente_nome: string
          cnpj: string
          cnpj_tomador: string
          competencia: string
          created_at: string
          descricao_servico: string
          emissao: string
          emitida_em: string | null
          enviado_whatsapp_em: string | null
          erro: string | null
          id: string
          motivo_cancelamento: string | null
          numero: string | null
          numero_nota: string | null
          numero_protocolo: string | null
          pdf_url: string | null
          regime: string
          serie: string
          status: string
          tentativas: number
          tomador: string
          tomador_cnpj: string | null
          tomador_razao: string | null
          ultimo_erro: string | null
          updated_at: string
          valor_cbs: number
          valor_ibs: number
          valor_iss: number
          valor_liquido: number
          valor_servico: number
          xml_url: string | null
        }
        Insert: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_iss: number
          cancelada_em?: string | null
          cliente_id: string
          cliente_nome: string
          cnpj: string
          cnpj_tomador: string
          competencia: string
          created_at?: string
          descricao_servico: string
          emissao: string
          emitida_em?: string | null
          enviado_whatsapp_em?: string | null
          erro?: string | null
          id?: string
          motivo_cancelamento?: string | null
          numero?: string | null
          numero_nota?: string | null
          numero_protocolo?: string | null
          pdf_url?: string | null
          regime: string
          serie?: string
          status?: string
          tentativas?: number
          tomador: string
          tomador_cnpj?: string | null
          tomador_razao?: string | null
          ultimo_erro?: string | null
          updated_at?: string
          valor_cbs?: number
          valor_ibs?: number
          valor_iss: number
          valor_liquido: number
          valor_servico: number
          xml_url?: string | null
        }
        Update: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_iss?: number
          cancelada_em?: string | null
          cliente_id?: string
          cliente_nome?: string
          cnpj?: string
          cnpj_tomador?: string
          competencia?: string
          created_at?: string
          descricao_servico?: string
          emissao?: string
          emitida_em?: string | null
          enviado_whatsapp_em?: string | null
          erro?: string | null
          id?: string
          motivo_cancelamento?: string | null
          numero?: string | null
          numero_nota?: string | null
          numero_protocolo?: string | null
          pdf_url?: string | null
          regime?: string
          serie?: string
          status?: string
          tentativas?: number
          tomador?: string
          tomador_cnpj?: string | null
          tomador_razao?: string | null
          ultimo_erro?: string | null
          updated_at?: string
          valor_cbs?: number
          valor_ibs?: number
          valor_iss?: number
          valor_liquido?: number
          valor_servico?: number
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfse_notas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      nfse_recebida: {
        Row: {
          aliquota_iss: number | null
          cliente_id: string
          cnpj_tomador: string
          codigo_servico: string | null
          codigo_verificacao: string | null
          competencia: string | null
          created_at: string
          data_emissao: string | null
          descricao_servico: string | null
          fonte: string | null
          id: string
          importada_em: string | null
          issretido: boolean | null
          focus_ref: string | null
          numero: string | null
          pdf_url: string | null
          prestador_cnpj: string | null
          prestador_municipio: string | null
          prestador_nome: string | null
          updated_at: string
          valor_iss: number | null
          valor_servico: number | null
          xml_content: string | null
        }
        Insert: {
          aliquota_iss?: number | null
          cliente_id: string
          cnpj_tomador: string
          codigo_servico?: string | null
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          descricao_servico?: string | null
          fonte?: string | null
          id?: string
          importada_em?: string | null
          issretido?: boolean | null
          focus_ref?: string | null
          numero?: string | null
          pdf_url?: string | null
          prestador_cnpj?: string | null
          prestador_municipio?: string | null
          prestador_nome?: string | null
          updated_at?: string
          valor_iss?: number | null
          valor_servico?: number | null
          xml_content?: string | null
        }
        Update: {
          aliquota_iss?: number | null
          cliente_id?: string
          cnpj_tomador?: string
          codigo_servico?: string | null
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          descricao_servico?: string | null
          fonte?: string | null
          id?: string
          importada_em?: string | null
          issretido?: boolean | null
          focus_ref?: string | null
          numero?: string | null
          pdf_url?: string | null
          prestador_cnpj?: string | null
          prestador_municipio?: string | null
          prestador_nome?: string | null
          updated_at?: string
          valor_iss?: number | null
          valor_servico?: number | null
          xml_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfse_recebida_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_nfse_log_legacy: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          duracao_ms: number | null
          erro_msg: string | null
          id: string
          focus_ref: string | null
          operacao: string
          payload: Json | null
          resposta: Json | null
          status: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          duracao_ms?: number | null
          erro_msg?: string | null
          id?: string
          focus_ref?: string | null
          operacao: string
          payload?: Json | null
          resposta?: Json | null
          status: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          duracao_ms?: number | null
          erro_msg?: string | null
          id?: string
          focus_ref?: string | null
          operacao?: string
          payload?: Json | null
          resposta?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_nfse_log_legacy_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      obrigacoes: {
        Row: {
          cliente_id: string
          cliente_nome: string
          codigo: string | null
          competencia: string
          concluida_em: string | null
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          descricao: string
          id: string
          nome: string | null
          observacoes: string | null
          regime: string
          responsavel: string
          status: string
          tipo: string
          updated_at: string
          valor: number | null
          valor_multa: number | null
          vencimento: string
        }
        Insert: {
          cliente_id: string
          cliente_nome: string
          codigo?: string | null
          competencia: string
          concluida_em?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao: string
          id: string
          nome?: string | null
          observacoes?: string | null
          regime: string
          responsavel: string
          status?: string
          tipo: string
          updated_at?: string
          valor?: number | null
          valor_multa?: number | null
          vencimento: string
        }
        Update: {
          cliente_id?: string
          cliente_nome?: string
          codigo?: string | null
          competencia?: string
          concluida_em?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao?: string
          id?: string
          nome?: string | null
          observacoes?: string | null
          regime?: string
          responsavel?: string
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number | null
          valor_multa?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "obrigacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos_contabeis: {
        Row: {
          checklist: Json | null
          created_at: string | null
          empresa_id: string
          fechado_em: string | null
          fechado_por: string | null
          id: string
          mes_referencia: string
          motivo_reabertura: string | null
          reaberto_em: string | null
          reaberto_por: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          checklist?: Json | null
          created_at?: string | null
          empresa_id: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes_referencia: string
          motivo_reabertura?: string | null
          reaberto_em?: string | null
          reaberto_por?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          checklist?: Json | null
          created_at?: string | null
          empresa_id?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes_referencia?: string
          motivo_reabertura?: string | null
          reaberto_em?: string | null
          reaberto_por?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "periodos_contabeis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes: {
        Row: {
          criado_em: string
          descricao: string | null
          id: string
          label: string
          setor_id: string
          slug: string
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          id?: string
          label: string
          setor_id: string
          slug: string
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          id?: string
          label?: string
          setor_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          aceita_lancamento: boolean | null
          ativo: boolean | null
          codigo: string
          codigo_pai: string | null
          created_at: string | null
          descricao: string
          empresa_id: string | null
          id: string
          natureza: string
          nivel: number
          tipo: string
        }
        Insert: {
          aceita_lancamento?: boolean | null
          ativo?: boolean | null
          codigo: string
          codigo_pai?: string | null
          created_at?: string | null
          descricao: string
          empresa_id?: string | null
          id?: string
          natureza: string
          nivel?: number
          tipo: string
        }
        Update: {
          aceita_lancamento?: boolean | null
          ativo?: boolean | null
          codigo?: string
          codigo_pai?: string | null
          created_at?: string | null
          descricao?: string
          empresa_id?: string | null
          id?: string
          natureza?: string
          nivel?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cliente_id: string | null
          created_at: string
          email: string
          id: string
          nome: string
        }
        Insert: {
          avatar_url?: string | null
          cliente_id?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
        }
        Update: {
          avatar_url?: string | null
          cliente_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      serpro_log: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          duracao_ms: number | null
          erro_msg: string | null
          id: string
          parametros: Json | null
          resultado_resumo: string | null
          status: string
          tool: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          duracao_ms?: number | null
          erro_msg?: string | null
          id?: string
          parametros?: Json | null
          resultado_resumo?: string | null
          status: string
          tool: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          duracao_ms?: number | null
          erro_msg?: string | null
          id?: string
          parametros?: Json | null
          resultado_resumo?: string | null
          status?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "serpro_log_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      servico_catalogo: {
        Row: {
          ativo: boolean
          categoria: string
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          requer_contrato: boolean
          requer_nota: boolean
          tags: string[] | null
          tipo: string
          unidade: string
          updated_at: string
          valor_padrao: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          requer_contrato?: boolean
          requer_nota?: boolean
          tags?: string[] | null
          tipo?: string
          unidade?: string
          updated_at?: string
          valor_padrao?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          requer_contrato?: boolean
          requer_nota?: boolean
          tags?: string[] | null
          tipo?: string
          unidade?: string
          updated_at?: string
          valor_padrao?: number
        }
        Relationships: []
      }
      servico_pagamento: {
        Row: {
          cliente_id: string
          cliente_servico_id: string
          competencia: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id: string
          cliente_servico_id: string
          competencia: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_id?: string
          cliente_servico_id?: string
          competencia?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "servico_pagamento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servico_pagamento_cliente_servico_id_fkey"
            columns: ["cliente_servico_id"]
            isOneToOne: false
            referencedRelation: "cliente_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cor: string | null
          criado_em: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          slug: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          slug: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          slug?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_setor_permissoes: {
        Row: {
          concedido_em: string
          concedido_por: string | null
          id: string
          permissao_id: string
          setor_id: string
          user_id: string
        }
        Insert: {
          concedido_em?: string
          concedido_por?: string | null
          id?: string
          permissao_id: string
          setor_id: string
          user_id: string
        }
        Update: {
          concedido_em?: string
          concedido_por?: string | null
          id?: string
          permissao_id?: string
          setor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_setor_permissoes_permissao_id_fkey"
            columns: ["permissao_id"]
            isOneToOne: false
            referencedRelation: "permissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_setor_permissoes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversa: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          avatar_url: string | null
          cliente_id: string | null
          contato_digitando_ate: string | null
          created_at: string
          departamento: string | null
          id: string
          instance_id: string
          nao_lidas: number
          nome_contato: string | null
          telefone: string
          ultima_em: string | null
          ultima_mensagem: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          cliente_id?: string | null
          contato_digitando_ate?: string | null
          created_at?: string
          departamento?: string | null
          id?: string
          instance_id: string
          nao_lidas?: number
          nome_contato?: string | null
          telefone: string
          ultima_em?: string | null
          ultima_mensagem?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          cliente_id?: string | null
          contato_digitando_ate?: string | null
          created_at?: string
          departamento?: string | null
          id?: string
          instance_id?: string
          nao_lidas?: number
          nome_contato?: string | null
          telefone?: string
          ultima_em?: string | null
          ultima_mensagem?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversa_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversa_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instance"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_instance: {
        Row: {
          created_at: string
          created_by: string | null
          departamentos: string[]
          display_name: string
          evolution_apikey: string | null
          id: string
          last_connected_at: string | null
          last_qr_at: string | null
          nome: string
          numero: string | null
          qr_code: string | null
          status: string
          updated_at: string
          user_id: string | null
          webhook_token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          departamentos?: string[]
          display_name: string
          evolution_apikey?: string | null
          id?: string
          last_connected_at?: string | null
          last_qr_at?: string | null
          nome: string
          numero?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          webhook_token?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          departamentos?: string[]
          display_name?: string
          evolution_apikey?: string | null
          id?: string
          last_connected_at?: string | null
          last_qr_at?: string | null
          nome?: string
          numero?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          webhook_token?: string
        }
        Relationships: []
      }
    }
      tarefas: {
        Row: {
          id: string
          titulo: string
          descricao: string | null
          tipo: string
          status: string
          prioridade: string
          cliente_id: string | null
          cliente_nome: string | null
          responsavel: string
          responsavel_tipo: string
          criado_por: string
          criado_por_tipo: string
          requer_aprovacao: boolean
          aprovador: string | null
          aprovador_tipo: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          motivo_rejeicao: string | null
          data_prazo: string | null
          sla_horas: number | null
          sla_status: string | null
          tarefa_pai_id: string | null
          subtarefas: Json
          subtarefas_total: number
          subtarefas_concluidas: number
          tags: Json
          anexos: Json
          comentarios: Json
          historico: Json
          origem: string | null
          concluida_em: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          titulo: string
          descricao?: string | null
          tipo?: string
          status?: string
          prioridade?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          responsavel: string
          responsavel_tipo?: string
          criado_por: string
          criado_por_tipo?: string
          requer_aprovacao?: boolean
          aprovador?: string | null
          aprovador_tipo?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          motivo_rejeicao?: string | null
          data_prazo?: string | null
          sla_horas?: number | null
          sla_status?: string | null
          tarefa_pai_id?: string | null
          subtarefas?: Json
          subtarefas_total?: number
          subtarefas_concluidas?: number
          tags?: Json
          anexos?: Json
          comentarios?: Json
          historico?: Json
          origem?: string | null
          concluida_em?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          titulo?: string
          descricao?: string | null
          tipo?: string
          status?: string
          prioridade?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          responsavel?: string
          responsavel_tipo?: string
          criado_por?: string
          criado_por_tipo?: string
          requer_aprovacao?: boolean
          aprovador?: string | null
          aprovador_tipo?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          motivo_rejeicao?: string | null
          data_prazo?: string | null
          sla_horas?: number | null
          sla_status?: string | null
          tarefa_pai_id?: string | null
          subtarefas?: Json
          subtarefas_total?: number
          subtarefas_concluidas?: number
          tags?: Json
          anexos?: Json
          comentarios?: Json
          historico?: Json
          origem?: string | null
          concluida_em?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
        leads_crm: {
        Row: {
          id: string
          nome: string
          telefone: string
          email: string | null
          cnpj: string | null
          razao_social: string | null
          nome_fantasia: string | null
          regime_tributario: string | null
          situacao_cadastral: string | null
          porte: string | null
          municipio: string | null
          uf: string | null
          socios: Json | null
          etapa: string
          temperatura: string
          origem: string
          canal: string
          responsavel: string
          honorario_proposto: number | null
          cliente_id: string | null
          contato_id: string | null
          conversa_id: string | null
          ultimo_contato: string | null
          proximo_passo: string | null
          motivo_perda: string | null
          observacoes: string | null
          tags: string[] | null
          metadados: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          telefone: string
          email?: string | null
          cnpj?: string | null
          razao_social?: string | null
          nome_fantasia?: string | null
          regime_tributario?: string | null
          situacao_cadastral?: string | null
          porte?: string | null
          municipio?: string | null
          uf?: string | null
          socios?: Json | null
          etapa: string
          temperatura: string
          origem: string
          canal: string
          responsavel: string
          honorario_proposto?: number | null
          cliente_id?: string | null
          contato_id?: string | null
          conversa_id?: string | null
          ultimo_contato?: string | null
          proximo_passo?: string | null
          motivo_perda?: string | null
          observacoes?: string | null
          tags?: string[] | null
          metadados?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          telefone?: string
          email?: string | null
          cnpj?: string | null
          razao_social?: string | null
          nome_fantasia?: string | null
          regime_tributario?: string | null
          situacao_cadastral?: string | null
          porte?: string | null
          municipio?: string | null
          uf?: string | null
          socios?: Json | null
          etapa?: string
          temperatura?: string
          origem?: string
          canal?: string
          responsavel?: string
          honorario_proposto?: number | null
          cliente_id?: string | null
          contato_id?: string | null
          conversa_id?: string | null
          ultimo_contato?: string | null
          proximo_passo?: string | null
          motivo_perda?: string | null
          observacoes?: string | null
          tags?: string[] | null
          metadados?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_cliente_id: { Args: never; Returns: string }
      has_permission: { Args: { p_slug: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_setor: { Args: { s_slug: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "contador"
        | "assistente"
        | "cliente"
        | "agente"
        | "supervisor"
      cliente_status:
        | "ativo"
        | "inadimplente"
        | "suspenso"
        | "inativo"
        | "em_analise"
      cobranca_status: "pendente" | "enviada" | "paga" | "vencida" | "cancelada"
      das_status:
        | "pendente"
        | "gerado"
        | "enviado_whatsapp"
        | "pago"
        | "vencido"
        | "erro"
      forma_pagamento: "PIX" | "Boleto" | "Débito automático"
      nfse_status: "pendente" | "emitida" | "cancelada" | "erro" | "rejeitada"
      obrigacao_status:
        | "pendente"
        | "em_andamento"
        | "concluido"
        | "atrasado"
        | "dispensado"
      regime_tributario:
        | "MEI"
        | "Simples Nacional"
        | "Lucro Presumido"
        | "Lucro Real"
        | "Doméstica"
      tier_servico: "MEI" | "Simples" | "Empresarial" | "Doméstica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "contador",
        "assistente",
        "cliente",
        "agente",
        "supervisor",
      ],
      cliente_status: [
        "ativo",
        "inadimplente",
        "suspenso",
        "inativo",
        "em_analise",
      ],
      cobranca_status: ["pendente", "enviada", "paga", "vencida", "cancelada"],
      das_status: [
        "pendente",
        "gerado",
        "enviado_whatsapp",
        "pago",
        "vencido",
        "erro",
      ],
      forma_pagamento: ["PIX", "Boleto", "Débito automático"],
      nfse_status: ["pendente", "emitida", "cancelada", "erro", "rejeitada"],
      obrigacao_status: [
        "pendente",
        "em_andamento",
        "concluido",
        "atrasado",
        "dispensado",
      ],
      regime_tributario: [
        "MEI",
        "Simples Nacional",
        "Lucro Presumido",
        "Lucro Real",
        "Doméstica",
      ],
      tier_servico: ["MEI", "Simples", "Empresarial", "Doméstica"],
    },
  },
} as const
