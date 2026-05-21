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
          tem_empregados: boolean
          tem_incentivo_fiscal: boolean
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
          tem_empregados?: boolean
          tem_incentivo_fiscal?: boolean
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
          tem_empregados?: boolean
          tem_incentivo_fiscal?: boolean
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
          nfeio_api_key: string | null
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
          nfeio_api_key?: string | null
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
          nfeio_api_key?: string | null
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
          webhook_token?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_cliente_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "contador" | "assistente" | "cliente"
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
      app_role: ["admin", "contador", "assistente", "cliente"],
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
