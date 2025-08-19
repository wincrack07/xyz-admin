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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          actor: string | null
          created_at: string
          entity: string | null
          event: string
          id: number
          owner_user_id: string
          payload: Json | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          entity?: string | null
          event: string
          id?: number
          owner_user_id: string
          payload?: Json | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          entity?: string | null
          event?: string
          id?: number
          owner_user_id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_alias: string
          account_number_mask: string
          bank_name: string
          created_at: string
          currency: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          account_alias: string
          account_number_mask: string
          bank_name: string
          created_at?: string
          currency?: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          account_alias?: string
          account_number_mask?: string
          bank_name?: string
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      category_rules: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          id: string
          owner_id: string
          pattern: string
          priority: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          id?: string
          owner_id: string
          pattern: string
          priority?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          pattern?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_notes: string | null
          created_at: string
          display_name: string
          emails: string[]
          id: string
          legal_name: string | null
          owner_user_id: string
          payment_terms_days: number
          preferences: Json | null
          preferred_currency: string | null
          tax_id: string | null
        }
        Insert: {
          billing_notes?: string | null
          created_at?: string
          display_name: string
          emails: string[]
          id?: string
          legal_name?: string | null
          owner_user_id: string
          payment_terms_days?: number
          preferences?: Json | null
          preferred_currency?: string | null
          tax_id?: string | null
        }
        Update: {
          billing_notes?: string | null
          created_at?: string
          display_name?: string
          emails?: string[]
          id?: string
          legal_name?: string | null
          owner_user_id?: string
          payment_terms_days?: number
          preferences?: Json | null
          preferred_currency?: string | null
          tax_id?: string | null
        }
        Relationships: []
      }
      conciliations: {
        Row: {
          auto_conciliated: boolean | null
          conciliated_amount: number | null
          conciliated_date: string | null
          conciliation_type: Database["public"]["Enums"]["conciliation_type"]
          created_at: string | null
          difference_amount: number | null
          expected_amount: number
          expected_date: string | null
          expense_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          owner_id: string
          recurring_plan_id: string | null
          status: Database["public"]["Enums"]["conciliation_status"]
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_conciliated?: boolean | null
          conciliated_amount?: number | null
          conciliated_date?: string | null
          conciliation_type: Database["public"]["Enums"]["conciliation_type"]
          created_at?: string | null
          difference_amount?: number | null
          expected_amount: number
          expected_date?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          owner_id: string
          recurring_plan_id?: string | null
          status?: Database["public"]["Enums"]["conciliation_status"]
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_conciliated?: boolean | null
          conciliated_amount?: number | null
          conciliated_date?: string | null
          conciliation_type?: Database["public"]["Enums"]["conciliation_type"]
          created_at?: string | null
          difference_amount?: number | null
          expected_amount?: number
          expected_date?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          owner_id?: string
          recurring_plan_id?: string | null
          status?: Database["public"]["Enums"]["conciliation_status"]
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliations_recurring_plan_id_fkey"
            columns: ["recurring_plan_id"]
            isOneToOne: false
            referencedRelation: "recurring_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_urls: string[] | null
          category: string
          conciliated_amount: number | null
          conciliation_status:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at: string
          currency: string
          description: string | null
          id: string
          last_conciliated_at: string | null
          owner_user_id: string
          payment_method: string | null
          spend_date: string
        }
        Insert: {
          amount: number
          attachment_urls?: string[] | null
          category: string
          conciliated_amount?: number | null
          conciliation_status?:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          last_conciliated_at?: string | null
          owner_user_id: string
          payment_method?: string | null
          spend_date: string
        }
        Update: {
          amount?: number
          attachment_urls?: string[] | null
          category?: string
          conciliated_amount?: number | null
          conciliation_status?:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          last_conciliated_at?: string | null
          owner_user_id?: string
          payment_method?: string | null
          spend_date?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          line_total: number
          owner_user_id: string
          quantity: number
          tax_rate: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          line_total: number
          owner_user_id: string
          quantity: number
          tax_rate?: number
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          owner_user_id?: string
          quantity?: number
          tax_rate?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          ach_screenshot_url: string | null
          client_id: string
          conciliated_amount: number | null
          conciliation_status:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at: string
          currency: string
          down_payment_amount: number | null
          due_date: string
          fx_rate: number | null
          id: string
          issue_date: string
          last_conciliated_at: string | null
          nmi_payment_id: string | null
          notes: string | null
          number: number
          owner_user_id: string
          payment_link_url: string | null
          payment_method: string | null
          payment_review_notes: string | null
          series: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          ach_screenshot_url?: string | null
          client_id: string
          conciliated_amount?: number | null
          conciliation_status?:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at?: string
          currency: string
          down_payment_amount?: number | null
          due_date: string
          fx_rate?: number | null
          id?: string
          issue_date: string
          last_conciliated_at?: string | null
          nmi_payment_id?: string | null
          notes?: string | null
          number: number
          owner_user_id: string
          payment_link_url?: string | null
          payment_method?: string | null
          payment_review_notes?: string | null
          series?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          ach_screenshot_url?: string | null
          client_id?: string
          conciliated_amount?: number | null
          conciliation_status?:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at?: string
          currency?: string
          down_payment_amount?: number | null
          due_date?: string
          fx_rate?: number | null
          id?: string
          issue_date?: string
          last_conciliated_at?: string | null
          nmi_payment_id?: string | null
          notes?: string | null
          number?: number
          owner_user_id?: string
          payment_link_url?: string | null
          payment_method?: string | null
          payment_review_notes?: string | null
          series?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_income: {
        Row: {
          amount: number
          category: string | null
          conciliated_amount: number | null
          conciliation_status:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at: string | null
          currency: string
          description: string
          id: string
          income_date: string
          last_conciliated_at: string | null
          notes: string | null
          owner_id: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          conciliated_amount?: number | null
          conciliation_status?:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at?: string | null
          currency?: string
          description: string
          id?: string
          income_date: string
          last_conciliated_at?: string | null
          notes?: string | null
          owner_id: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          conciliated_amount?: number | null
          conciliation_status?:
            | Database["public"]["Enums"]["conciliation_status"]
            | null
          created_at?: string | null
          currency?: string
          description?: string
          id?: string
          income_date?: string
          last_conciliated_at?: string | null
          notes?: string | null
          owner_id?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          client_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          meta: Json | null
          owner_user_id: string
          scheduled_for: string
          status: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          client_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          meta?: Json | null
          owner_user_id: string
          scheduled_for: string
          status?: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          client_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          meta?: Json | null
          owner_user_id?: string
          scheduled_for?: string
          status?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_id: string
          method: string | null
          nmi_txn_id: string | null
          owner_user_id: string
          paid_at: string | null
          raw_payload: Json | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          invoice_id: string
          method?: string | null
          nmi_txn_id?: string | null
          owner_user_id: string
          paid_at?: string | null
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string
          method?: string | null
          nmi_txn_id?: string | null
          owner_user_id?: string
          paid_at?: string | null
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      products_services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_user_id: string
          tax_rate: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_user_id: string
          tax_rate?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          tax_rate?: number
          unit_price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          default_currency: string
          email_from: string | null
          email_provider_api_key: string | null
          full_name: string | null
          id: string
          nmi_api_key: string | null
          nmi_sandbox_mode: boolean | null
          nmi_security_key: string | null
          preferences: Json | null
          timezone: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          default_currency?: string
          email_from?: string | null
          email_provider_api_key?: string | null
          full_name?: string | null
          id: string
          nmi_api_key?: string | null
          nmi_sandbox_mode?: boolean | null
          nmi_security_key?: string | null
          preferences?: Json | null
          timezone?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          default_currency?: string
          email_from?: string | null
          email_provider_api_key?: string | null
          full_name?: string | null
          id?: string
          nmi_api_key?: string | null
          nmi_sandbox_mode?: boolean | null
          nmi_security_key?: string | null
          preferences?: Json | null
          timezone?: string
        }
        Relationships: []
      }
      recurring_plans: {
        Row: {
          active: boolean
          auto_generate_invoices: boolean | null
          client_id: string
          created_at: string
          currency: string
          id: string
          last_invoice_generated_at: string | null
          next_generation: string
          next_invoice_date: string | null
          owner_user_id: string
          periodicity: Database["public"]["Enums"]["periodicity"]
          template_items: Json
          terms: string | null
        }
        Insert: {
          active?: boolean
          auto_generate_invoices?: boolean | null
          client_id: string
          created_at?: string
          currency: string
          id?: string
          last_invoice_generated_at?: string | null
          next_generation: string
          next_invoice_date?: string | null
          owner_user_id: string
          periodicity: Database["public"]["Enums"]["periodicity"]
          template_items: Json
          terms?: string | null
        }
        Update: {
          active?: boolean
          auto_generate_invoices?: boolean | null
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          last_invoice_generated_at?: string | null
          next_generation?: string
          next_invoice_date?: string | null
          owner_user_id?: string
          periodicity?: Database["public"]["Enums"]["periodicity"]
          template_items?: Json
          terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_categories: {
        Row: {
          category_id: string
          created_at: string
          transaction_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          transaction_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_categories_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string
          created_at: string
          currency: string
          description: string
          external_fingerprint: string
          id: string
          merchant_name: string | null
          owner_id: string
          posted_at: string
          raw: Json
          updated_at: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id: string
          created_at?: string
          currency?: string
          description: string
          external_fingerprint: string
          id?: string
          merchant_name?: string | null
          owner_id: string
          posted_at: string
          raw: Json
          updated_at?: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string
          created_at?: string
          currency?: string
          description?: string
          external_fingerprint?: string
          id?: string
          merchant_name?: string | null
          owner_id?: string
          posted_at?: string
          raw?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      conciliation_dashboard: {
        Row: {
          conciliated_expenses: number | null
          conciliated_invoices: number | null
          conciliated_manual_income: number | null
          owner_id: string | null
          pending_expense_amount: number | null
          pending_expenses: number | null
          pending_invoice_amount: number | null
          pending_invoices: number | null
          pending_manual_income: number | null
          pending_manual_income_amount: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_edit_invoice: {
        Args: { p_invoice_id: string }
        Returns: boolean
      }
      get_invoice_editability: {
        Args: { p_invoice_id: string }
        Returns: {
          can_edit: boolean
          can_revert_to_cotizacion: boolean
          current_status: string
          payment_count: number
          requires_credit_note: boolean
          total_paid: number
        }[]
      }
      get_next_invoice_number: {
        Args: { p_owner_user_id: string; p_series: string }
        Returns: number
      }
      get_nmi_credentials: {
        Args: { user_id: string }
        Returns: {
          nmi_sandbox_mode: boolean
          nmi_security_key: string
        }[]
      }
      is_invoice_publicly_accessible: {
        Args: { invoice_id: string }
        Returns: boolean
      }
      revert_invoice_to_cotizacion: {
        Args: { p_invoice_id: string }
        Returns: boolean
      }
      update_invoice_status_for_ach_payment: {
        Args: { p_invoice_id: string; p_screenshot_url: string }
        Returns: boolean
      }
    }
    Enums: {
      conciliation_status: "pending" | "partial" | "complete" | "cancelled"
      conciliation_type:
        | "invoice_payment"
        | "expense_payment"
        | "manual_income"
        | "subscription_payment"
      invoice_status:
        | "cotizacion"
        | "sent"
        | "pending"
        | "paid"
        | "partial"
        | "failed"
        | "refunded"
        | "void"
        | "chargeback"
        | "payment_review"
        | "payment_approved"
      notification_channel: "email"
      notification_type:
        | "invoice_created"
        | "payment_reminder"
        | "payment_received"
        | "statement"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partial"
        | "chargeback"
        | "void"
      periodicity: "monthly" | "quarterly"
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
      conciliation_status: ["pending", "partial", "complete", "cancelled"],
      conciliation_type: [
        "invoice_payment",
        "expense_payment",
        "manual_income",
        "subscription_payment",
      ],
      invoice_status: [
        "cotizacion",
        "sent",
        "pending",
        "paid",
        "partial",
        "failed",
        "refunded",
        "void",
        "chargeback",
        "payment_review",
        "payment_approved",
      ],
      notification_channel: ["email"],
      notification_type: [
        "invoice_created",
        "payment_reminder",
        "payment_received",
        "statement",
      ],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "partial",
        "chargeback",
        "void",
      ],
      periodicity: ["monthly", "quarterly"],
    },
  },
} as const
