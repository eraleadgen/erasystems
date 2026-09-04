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
      bookings: {
        Row: {
          business_id: string
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          ends_at: string | null
          id: string
          notes: string | null
          service_id: string | null
          specialist_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_cents: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          ends_at?: string | null
          id?: string
          notes?: string | null
          service_id?: string | null
          specialist_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_cents?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          ends_at?: string | null
          id?: string
          notes?: string | null
          service_id?: string | null
          specialist_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      business_addons: {
        Row: {
          activated_at: string
          addon: Database["public"]["Enums"]["addon_kind"]
          billing_interval: string
          business_id: string
          created_at: string
          currency: string
          deactivated_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          price_cents: number
          updated_at: string
        }
        Insert: {
          activated_at?: string
          addon: Database["public"]["Enums"]["addon_kind"]
          billing_interval?: string
          business_id: string
          created_at?: string
          currency?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          price_cents: number
          updated_at?: string
        }
        Update: {
          activated_at?: string
          addon?: Database["public"]["Enums"]["addon_kind"]
          billing_interval?: string
          business_id?: string
          created_at?: string
          currency?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_addons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_domains: {
        Row: {
          business_id: string
          created_at: string
          hostname: string
          is_primary: boolean
          verified_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          hostname: string
          is_primary?: boolean
          verified_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          hostname?: string
          is_primary?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_domains_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_launch_status: {
        Row: {
          business_id: string
          item_key: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          item_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          item_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_launch_status_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          brand_accent: string | null
          brand_primary: string | null
          created_at: string
          id: string
          is_active: boolean
          legal_name: string | null
          lifecycle: Database["public"]["Enums"]["business_lifecycle"]
          logo_url: string | null
          name: string
          origin_invite_id: string | null
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          slug: string
          slug_reserved_until: string | null
          support_email: string | null
          support_phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_accent?: string | null
          brand_primary?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          lifecycle?: Database["public"]["Enums"]["business_lifecycle"]
          logo_url?: string | null
          name: string
          origin_invite_id?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          slug: string
          slug_reserved_until?: string | null
          support_email?: string | null
          support_phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_accent?: string | null
          brand_primary?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          lifecycle?: Database["public"]["Enums"]["business_lifecycle"]
          logo_url?: string | null
          name?: string
          origin_invite_id?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          slug?: string
          slug_reserved_until?: string | null
          support_email?: string | null
          support_phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_origin_invite_id_fkey"
            columns: ["origin_invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      client_delivery_tasks: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          owner: string
          status: string
          task_key: string
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          owner?: string
          status?: string
          task_key: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          owner?: string
          status?: string
          task_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_delivery_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      client_provisioning: {
        Row: {
          a2p_notes: string | null
          a2p_required: boolean
          a2p_status: string
          business_id: string
          completed_at: string | null
          created_at: string
          domain_status: string
          overview_notes: string | null
          requested_domain: string | null
          updated_at: string
          website_status: string
          website_url: string | null
        }
        Insert: {
          a2p_notes?: string | null
          a2p_required?: boolean
          a2p_status?: string
          business_id: string
          completed_at?: string | null
          created_at?: string
          domain_status?: string
          overview_notes?: string | null
          requested_domain?: string | null
          updated_at?: string
          website_status?: string
          website_url?: string | null
        }
        Update: {
          a2p_notes?: string | null
          a2p_required?: boolean
          a2p_status?: string
          business_id?: string
          completed_at?: string | null
          created_at?: string
          domain_status?: string
          overview_notes?: string | null
          requested_domain?: string | null
          updated_at?: string
          website_status?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_provisioning_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_requests: {
        Row: {
          business_name: string
          business_type: string | null
          calendar_event_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string | null
          scheduled_start: string | null
          source_hostname: string | null
          status: string
        }
        Insert: {
          business_name: string
          business_type?: string | null
          calendar_event_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone?: string | null
          scheduled_start?: string | null
          source_hostname?: string | null
          status?: string
        }
        Update: {
          business_name?: string
          business_type?: string | null
          calendar_event_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string | null
          scheduled_start?: string | null
          source_hostname?: string | null
          status?: string
        }
        Relationships: []
      }
      invite_addons: {
        Row: {
          addon: Database["public"]["Enums"]["addon_kind"]
          billing_interval: string
          created_at: string
          id: string
          invite_id: string
          notes: string | null
          price_cents: number
        }
        Insert: {
          addon: Database["public"]["Enums"]["addon_kind"]
          billing_interval?: string
          created_at?: string
          id?: string
          invite_id: string
          notes?: string | null
          price_cents: number
        }
        Update: {
          addon?: Database["public"]["Enums"]["addon_kind"]
          billing_interval?: string
          created_at?: string
          id?: string
          invite_id?: string
          notes?: string | null
          price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_addons_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_attempts: {
        Row: {
          blocked_until: string | null
          failures: number
          ip: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          blocked_until?: string | null
          failures?: number
          ip: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          blocked_until?: string | null
          failures?: number
          ip?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          billing_interval: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          notes: string | null
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          setup_fee_cents: number
          status: Database["public"]["Enums"]["invite_status"]
          subscription_price_cents: number
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          billing_interval?: string
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by?: string | null
          notes?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          setup_fee_cents?: number
          status?: Database["public"]["Enums"]["invite_status"]
          subscription_price_cents?: number
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          billing_interval?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          notes?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          setup_fee_cents?: number
          status?: Database["public"]["Enums"]["invite_status"]
          subscription_price_cents?: number
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_drafts: {
        Row: {
          business_id: string | null
          created_at: string
          current_step: number
          data: Json
          id: string
          status: Database["public"]["Enums"]["onboarding_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          current_step?: number
          data?: Json
          id?: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          current_step?: number
          data?: Json
          id?: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          activated_at: string | null
          amount_cents: number
          api_verified_at: string | null
          business_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          provider: string
          provider_event_id: string | null
          provider_session_id: string | null
          raw_summary: Json | null
          status: string
          updated_at: string
          webhook_verified_at: string | null
        }
        Insert: {
          activated_at?: string | null
          amount_cents: number
          api_verified_at?: string | null
          business_id: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          provider?: string
          provider_event_id?: string | null
          provider_session_id?: string | null
          raw_summary?: Json | null
          status?: string
          updated_at?: string
          webhook_verified_at?: string | null
        }
        Update: {
          activated_at?: string | null
          amount_cents?: number
          api_verified_at?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          provider?: string
          provider_event_id?: string | null
          provider_session_id?: string | null
          raw_summary?: Json | null
          status?: string
          updated_at?: string
          webhook_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_tier_features: {
        Row: {
          feature: Database["public"]["Enums"]["platform_feature"]
          plan_tier: Database["public"]["Enums"]["plan_tier"]
        }
        Insert: {
          feature: Database["public"]["Enums"]["platform_feature"]
          plan_tier: Database["public"]["Enums"]["plan_tier"]
        }
        Update: {
          feature?: Database["public"]["Enums"]["platform_feature"]
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
        }
        Relationships: []
      }
      platform_staff: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price_cents: number
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_paid_business: {
        Args: { _business_id: string }
        Returns: boolean
      }
      consume_invite: {
        Args: { _token_hash: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      invite_throttle_check: { Args: { _ip: string }; Returns: boolean }
      invite_throttle_record: { Args: { _ip: string }; Returns: undefined }
      is_platform_staff: { Args: never; Returns: boolean }
      release_invite: { Args: { _invite_id: string }; Returns: undefined }
    }
    Enums: {
      addon_kind: "ad_management" | "white_label_branding"
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      business_lifecycle: "pending_payment" | "active" | "suspended" | "expired"
      business_role: "owner" | "admin" | "specialist" | "customer"
      invite_status: "pending" | "accepted" | "revoked"
      onboarding_status: "in_progress" | "completed"
      plan_tier: "basic" | "growth" | "enterprise"
      platform_feature:
        | "website"
        | "ai_chat_widget"
        | "core_engines"
        | "payments"
        | "admin_dashboard"
        | "self_serve_setup"
        | "email_automations"
        | "customer_portal"
        | "specialist_portal"
        | "voice_sms_agent"
        | "sms_automations"
        | "advanced_analytics"
        | "partner_network"
      platform_role: "platform_admin" | "platform_support"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      addon_kind: ["ad_management", "white_label_branding"],
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      business_lifecycle: ["pending_payment", "active", "suspended", "expired"],
      business_role: ["owner", "admin", "specialist", "customer"],
      invite_status: ["pending", "accepted", "revoked"],
      onboarding_status: ["in_progress", "completed"],
      plan_tier: ["basic", "growth", "enterprise"],
      platform_feature: [
        "website",
        "ai_chat_widget",
        "core_engines",
        "payments",
        "admin_dashboard",
        "self_serve_setup",
        "email_automations",
        "customer_portal",
        "specialist_portal",
        "voice_sms_agent",
        "sms_automations",
        "advanced_analytics",
        "partner_network",
      ],
      platform_role: ["platform_admin", "platform_support"],
    },
  },
} as const
