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
      bag_models: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          shopify_product_id: string | null
          slug: string
          sort_order: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          shopify_product_id?: string | null
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          shopify_product_id?: string | null
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bag_views: {
        Row: {
          asset_notes: string | null
          bag_model_id: string
          base_image_url: string | null
          canvas_height: number
          canvas_width: number
          created_at: string
          custom_label: string | null
          id: string
          is_active: boolean
          overlay_details_url: string | null
          overlay_highlights_url: string | null
          overlay_shadows_url: string | null
          overlay_url: string | null
          sort_order: number
          updated_at: string
          view_type: string
        }
        Insert: {
          asset_notes?: string | null
          bag_model_id: string
          base_image_url?: string | null
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          custom_label?: string | null
          id?: string
          is_active?: boolean
          overlay_details_url?: string | null
          overlay_highlights_url?: string | null
          overlay_shadows_url?: string | null
          overlay_url?: string | null
          sort_order?: number
          updated_at?: string
          view_type: string
        }
        Update: {
          asset_notes?: string | null
          bag_model_id?: string
          base_image_url?: string | null
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          custom_label?: string | null
          id?: string
          is_active?: boolean
          overlay_details_url?: string | null
          overlay_highlights_url?: string | null
          overlay_shadows_url?: string | null
          overlay_url?: string | null
          sort_order?: number
          updated_at?: string
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bag_views_bag_model_id_fkey"
            columns: ["bag_model_id"]
            isOneToOne: false
            referencedRelation: "bag_models"
            referencedColumns: ["id"]
          },
        ]
      }
      compatibility_rules: {
        Row: {
          created_at: string
          entity_a_id: string
          entity_b_id: string
          id: string
          is_allowed: boolean
          rule_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_a_id: string
          entity_b_id: string
          id?: string
          is_allowed?: boolean
          rule_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_a_id?: string
          entity_b_id?: string
          id?: string
          is_allowed?: boolean
          rule_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      configurations: {
        Row: {
          bag_model_id: string
          created_at: string
          embroidery_id: string | null
          expires_at: string | null
          fabric_id: string
          final_price: number
          handle_color_id: string
          handle_id: string
          id: string
          preview_url: string | null
          session_id: string
          shopify_product_id: string | null
          shopify_variant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bag_model_id: string
          created_at?: string
          embroidery_id?: string | null
          expires_at?: string | null
          fabric_id: string
          final_price?: number
          handle_color_id: string
          handle_id: string
          id?: string
          preview_url?: string | null
          session_id: string
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bag_model_id?: string
          created_at?: string
          embroidery_id?: string | null
          expires_at?: string | null
          fabric_id?: string
          final_price?: number
          handle_color_id?: string
          handle_id?: string
          id?: string
          preview_url?: string | null
          session_id?: string
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configurations_bag_model_id_fkey"
            columns: ["bag_model_id"]
            isOneToOne: false
            referencedRelation: "bag_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configurations_embroidery_id_fkey"
            columns: ["embroidery_id"]
            isOneToOne: false
            referencedRelation: "embroideries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configurations_fabric_id_fkey"
            columns: ["fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configurations_handle_color_id_fkey"
            columns: ["handle_color_id"]
            isOneToOne: false
            referencedRelation: "handle_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configurations_handle_id_fkey"
            columns: ["handle_id"]
            isOneToOne: false
            referencedRelation: "handles"
            referencedColumns: ["id"]
          },
        ]
      }
      cord_collection: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          pattern_preset_id: string | null
          sort_order: number
          style_type: string
          texture_rotation: number
          texture_scale: number
          texture_url: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pattern_preset_id?: string | null
          sort_order?: number
          style_type: string
          texture_rotation?: number
          texture_scale?: number
          texture_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pattern_preset_id?: string | null
          sort_order?: number
          style_type?: string
          texture_rotation?: number
          texture_scale?: number
          texture_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cord_collection_pattern_preset_id_fkey"
            columns: ["pattern_preset_id"]
            isOneToOne: false
            referencedRelation: "handle_pattern_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      cord_handle_compatibility: {
        Row: {
          cord_id: string
          created_at: string
          handle_id: string
          id: string
        }
        Insert: {
          cord_id: string
          created_at?: string
          handle_id: string
          id?: string
        }
        Update: {
          cord_id?: string
          created_at?: string
          handle_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cord_handle_compatibility_cord_id_fkey"
            columns: ["cord_id"]
            isOneToOne: false
            referencedRelation: "cord_collection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cord_handle_compatibility_handle_id_fkey"
            columns: ["handle_id"]
            isOneToOne: false
            referencedRelation: "handles"
            referencedColumns: ["id"]
          },
        ]
      }
      embroideries: {
        Row: {
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      embroidery_placements: {
        Row: {
          bag_view_id: string
          created_at: string
          id: string
          is_active: boolean
          max_height: number
          max_width: number
          position_x: number
          position_y: number
          rotation: number
          safe_area_json: Json | null
          scale: number
          updated_at: string
        }
        Insert: {
          bag_view_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_height?: number
          max_width?: number
          position_x?: number
          position_y?: number
          rotation?: number
          safe_area_json?: Json | null
          scale?: number
          updated_at?: string
        }
        Update: {
          bag_view_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_height?: number
          max_width?: number
          position_x?: number
          position_y?: number
          rotation?: number
          safe_area_json?: Json | null
          scale?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embroidery_placements_bag_view_id_fkey"
            columns: ["bag_view_id"]
            isOneToOne: true
            referencedRelation: "bag_views"
            referencedColumns: ["id"]
          },
        ]
      }
      fabric_colors: {
        Row: {
          created_at: string
          derived_fabric_id: string | null
          fabric_id: string
          hex: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          derived_fabric_id?: string | null
          fabric_id: string
          hex?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          derived_fabric_id?: string | null
          fabric_id?: string
          hex?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabric_colors_derived_fabric_id_fkey"
            columns: ["derived_fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabric_colors_fabric_id_fkey"
            columns: ["fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrics: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          pattern_scale: number
          price_modifier: number
          repeat_mode: string
          slug: string
          sort_order: number
          texture_url: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pattern_scale?: number
          price_modifier?: number
          repeat_mode?: string
          slug: string
          sort_order?: number
          texture_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pattern_scale?: number
          price_modifier?: number
          repeat_mode?: string
          slug?: string
          sort_order?: number
          texture_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      handle_colors: {
        Row: {
          color_hex: string
          color_name: string
          colors: Json
          created_at: string
          handle_id: string
          id: string
          is_active: boolean
          pattern_preset_id: string | null
          sort_order: number
          texture_rotation: number
          texture_scale: number
          texture_url: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          color_hex?: string
          color_name: string
          colors?: Json
          created_at?: string
          handle_id: string
          id?: string
          is_active?: boolean
          pattern_preset_id?: string | null
          sort_order?: number
          texture_rotation?: number
          texture_scale?: number
          texture_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          color_hex?: string
          color_name?: string
          colors?: Json
          created_at?: string
          handle_id?: string
          id?: string
          is_active?: boolean
          pattern_preset_id?: string | null
          sort_order?: number
          texture_rotation?: number
          texture_scale?: number
          texture_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handle_colors_handle_id_fkey"
            columns: ["handle_id"]
            isOneToOne: false
            referencedRelation: "handles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handle_colors_pattern_preset_id_fkey"
            columns: ["pattern_preset_id"]
            isOneToOne: false
            referencedRelation: "handle_pattern_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      handle_geometries: {
        Row: {
          bag_view_id: string
          created_at: string
          default_width: number
          details_url: string | null
          hardware_url: string | null
          highlight_url: string | null
          id: string
          is_active: boolean
          mask_url: string | null
          path_json: Json
          shadow_url: string | null
          updated_at: string
        }
        Insert: {
          bag_view_id: string
          created_at?: string
          default_width?: number
          details_url?: string | null
          hardware_url?: string | null
          highlight_url?: string | null
          id?: string
          is_active?: boolean
          mask_url?: string | null
          path_json?: Json
          shadow_url?: string | null
          updated_at?: string
        }
        Update: {
          bag_view_id?: string
          created_at?: string
          default_width?: number
          details_url?: string | null
          hardware_url?: string | null
          highlight_url?: string | null
          id?: string
          is_active?: boolean
          mask_url?: string | null
          path_json?: Json
          shadow_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handle_geometries_bag_view_id_fkey"
            columns: ["bag_view_id"]
            isOneToOne: true
            referencedRelation: "bag_views"
            referencedColumns: ["id"]
          },
        ]
      }
      handle_pattern_presets: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          preset_json: Json
          sort_order: number
          stripe_count: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          preset_json?: Json
          sort_order?: number
          stripe_count?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          preset_json?: Json
          sort_order?: number
          stripe_count?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      handle_side_parts: {
        Row: {
          created_at: string
          handle_geometry_id: string
          highlight_url: string | null
          id: string
          is_active: boolean
          mask_url: string | null
          part_id: string
          path_json: Json
          rotation: number
          shadow_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          handle_geometry_id: string
          highlight_url?: string | null
          id?: string
          is_active?: boolean
          mask_url?: string | null
          part_id: string
          path_json?: Json
          rotation?: number
          shadow_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          handle_geometry_id?: string
          highlight_url?: string | null
          id?: string
          is_active?: boolean
          mask_url?: string | null
          part_id?: string
          path_json?: Json
          rotation?: number
          shadow_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handle_side_parts_handle_geometry_id_fkey"
            columns: ["handle_geometry_id"]
            isOneToOne: false
            referencedRelation: "handle_geometries"
            referencedColumns: ["id"]
          },
        ]
      }
      handles: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      layer_order_rules: {
        Row: {
          bag_view_id: string
          blend_mode: string
          created_at: string
          id: string
          is_active: boolean
          layer_type: string
          opacity: number
          updated_at: string
          z_index: number
        }
        Insert: {
          bag_view_id: string
          blend_mode?: string
          created_at?: string
          id?: string
          is_active?: boolean
          layer_type: string
          opacity?: number
          updated_at?: string
          z_index?: number
        }
        Update: {
          bag_view_id?: string
          blend_mode?: string
          created_at?: string
          id?: string
          is_active?: boolean
          layer_type?: string
          opacity?: number
          updated_at?: string
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "layer_order_rules_bag_view_id_fkey"
            columns: ["bag_view_id"]
            isOneToOne: false
            referencedRelation: "bag_views"
            referencedColumns: ["id"]
          },
        ]
      }
      mask_zones: {
        Row: {
          bag_view_id: string
          blend_mode: string
          created_at: string
          id: string
          label: string | null
          local_overlay_url: string | null
          mask_image_url: string | null
          scale_correction_factor: number
          shading_strength: number
          sort_order: number
          texture_offset_x: number
          texture_offset_y: number
          texture_repeat_mode: string
          texture_rotation: number
          texture_scale: number
          texture_url: string | null
          tint_color: string | null
          updated_at: string
          z_index: number
          zone_category: string
          zone_type: string
        }
        Insert: {
          bag_view_id: string
          blend_mode?: string
          created_at?: string
          id?: string
          label?: string | null
          local_overlay_url?: string | null
          mask_image_url?: string | null
          scale_correction_factor?: number
          shading_strength?: number
          sort_order?: number
          texture_offset_x?: number
          texture_offset_y?: number
          texture_repeat_mode?: string
          texture_rotation?: number
          texture_scale?: number
          texture_url?: string | null
          tint_color?: string | null
          updated_at?: string
          z_index?: number
          zone_category?: string
          zone_type: string
        }
        Update: {
          bag_view_id?: string
          blend_mode?: string
          created_at?: string
          id?: string
          label?: string | null
          local_overlay_url?: string | null
          mask_image_url?: string | null
          scale_correction_factor?: number
          shading_strength?: number
          sort_order?: number
          texture_offset_x?: number
          texture_offset_y?: number
          texture_repeat_mode?: string
          texture_rotation?: number
          texture_scale?: number
          texture_url?: string | null
          tint_color?: string | null
          updated_at?: string
          z_index?: number
          zone_category?: string
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mask_zones_bag_view_id_fkey"
            columns: ["bag_view_id"]
            isOneToOne: false
            referencedRelation: "bag_views"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          bag_model_id: string
          created_at: string
          fabric_id: string
          final_price: number
          id: string
          updated_at: string
        }
        Insert: {
          bag_model_id: string
          created_at?: string
          fabric_id: string
          final_price: number
          id?: string
          updated_at?: string
        }
        Update: {
          bag_model_id?: string
          created_at?: string
          fabric_id?: string
          final_price?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_bag_model_id_fkey"
            columns: ["bag_model_id"]
            isOneToOne: false
            referencedRelation: "bag_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_fabric_id_fkey"
            columns: ["fabric_id"]
            isOneToOne: false
            referencedRelation: "fabrics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
