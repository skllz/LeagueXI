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
      competition_provider_mappings: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          provider: string
          provider_competition_id: string
          updated_at: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          provider: string
          provider_competition_id: string
          updated_at?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          provider?: string
          provider_competition_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_provider_mappings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          country: string | null
          ends_at: string
          id: string
          is_active: boolean
          name: string
          season: string
          slug: string
          starts_at: string
          type: string | null
        }
        Insert: {
          country?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          name: string
          season: string
          slug: string
          starts_at: string
          type?: string | null
        }
        Update: {
          country?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          name?: string
          season?: string
          slug?: string
          starts_at?: string
          type?: string | null
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_provider_mappings: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          provider: string
          provider_fixture_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          provider: string
          provider_fixture_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          provider?: string
          provider_fixture_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_provider_mappings_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
        ]
      }
      fixtures: {
        Row: {
          admin_exclude_override: boolean | null
          admin_include_override: boolean | null
          away_score: number | null
          away_team_id: string
          competition_id: string
          competition_name: string | null
          competition_type: string | null
          created_at: string
          home_score: number | null
          home_team_id: string
          id: string
          inclusion_source: string | null
          is_competitive: boolean | null
          is_friendly: boolean | null
          is_included: boolean | null
          kickoff_datetime_utc: string
          last_synced_at: string | null
          locking_reminder_sent_at: string | null
          round: string | null
          round_id: string | null
          season_id: string | null
          season_label: string | null
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
        }
        Insert: {
          admin_exclude_override?: boolean | null
          admin_include_override?: boolean | null
          away_score?: number | null
          away_team_id: string
          competition_id: string
          competition_name?: string | null
          competition_type?: string | null
          created_at?: string
          home_score?: number | null
          home_team_id: string
          id?: string
          inclusion_source?: string | null
          is_competitive?: boolean | null
          is_friendly?: boolean | null
          is_included?: boolean | null
          kickoff_datetime_utc: string
          last_synced_at?: string | null
          locking_reminder_sent_at?: string | null
          round?: string | null
          round_id?: string | null
          season_id?: string | null
          season_label?: string | null
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
        }
        Update: {
          admin_exclude_override?: boolean | null
          admin_include_override?: boolean | null
          away_score?: number | null
          away_team_id?: string
          competition_id?: string
          competition_name?: string | null
          competition_type?: string | null
          created_at?: string
          home_score?: number | null
          home_team_id?: string
          id?: string
          inclusion_source?: string | null
          is_competitive?: boolean | null
          is_friendly?: boolean | null
          is_included?: boolean | null
          kickoff_datetime_utc?: string
          last_synced_at?: string | null
          locking_reminder_sent_at?: string | null
          round?: string | null
          round_id?: string | null
          season_id?: string | null
          season_label?: string | null
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "leaguexi_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          calculated_at: string
          correct_outcomes: number
          correct_scores: number
          id: string
          league_id: string | null
          points: number
          prediction_context_id: string
          rank: number | null
          round_id: string | null
          season_id: string | null
          user_id: string
        }
        Insert: {
          calculated_at?: string
          correct_outcomes?: number
          correct_scores?: number
          id?: string
          league_id?: string | null
          points?: number
          prediction_context_id: string
          rank?: number | null
          round_id?: string | null
          season_id?: string | null
          user_id: string
        }
        Update: {
          calculated_at?: string
          correct_outcomes?: number
          correct_scores?: number
          id?: string
          league_id?: string | null
          points?: number
          prediction_context_id?: string
          rank?: number | null
          round_id?: string | null
          season_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_prediction_context_id_fkey"
            columns: ["prediction_context_id"]
            isOneToOne: false
            referencedRelation: "prediction_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "leaguexi_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          creator_user_id: string
          description: string | null
          id: string
          invite_code: string
          is_archived: boolean
          logo_url: string | null
          name: string
          prize_description: string | null
          slug: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          creator_user_id: string
          description?: string | null
          id?: string
          invite_code: string
          is_archived?: boolean
          logo_url?: string | null
          name: string
          prize_description?: string | null
          slug: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          creator_user_id?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_archived?: boolean
          logo_url?: string | null
          name?: string
          prize_description?: string | null
          slug?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_owner_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaguexi_rounds: {
        Row: {
          created_at: string
          end_datetime: string
          finalized_at: string | null
          id: string
          prediction_context_id: string
          round_number: number
          season_id: string
          start_datetime: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_datetime: string
          finalized_at?: string | null
          id?: string
          prediction_context_id: string
          round_number: number
          season_id: string
          start_datetime: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_datetime?: string
          finalized_at?: string | null
          id?: string
          prediction_context_id?: string
          round_number?: number
          season_id?: string
          start_datetime?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaguexi_rounds_prediction_context_id_fkey"
            columns: ["prediction_context_id"]
            isOneToOne: false
            referencedRelation: "prediction_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaguexi_rounds_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_contexts: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          name: string
          season_id: string | null
          starts_at: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          season_id?: string | null
          starts_at?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          season_id?: string | null
          starts_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_contexts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          created_at: string
          fixture_id: string
          id: string
          is_locked: boolean
          points: number | null
          predicted_away_score: number
          predicted_home_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          id?: string
          is_locked?: boolean
          points?: number | null
          predicted_away_score: number
          predicted_home_score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          id?: string
          is_locked?: boolean
          points?: number | null
          predicted_away_score?: number
          predicted_home_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_locks: {
        Row: {
          expires_at: string
          job: string
          locked_at: string
        }
        Insert: {
          expires_at: string
          job: string
          locked_at?: string
        }
        Update: {
          expires_at?: string
          job?: string
          locked_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          provider: string | null
          records_processed: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          provider?: string | null
          records_processed?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          provider?: string | null
          records_processed?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_sync_type: string | null
          resolved_at: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_sync_type?: string | null
          resolved_at?: string | null
          severity: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_sync_type?: string | null
          resolved_at?: string | null
          severity?: string
        }
        Relationships: []
      }
      team_provider_mappings: {
        Row: {
          created_at: string
          id: string
          provider: string
          provider_team_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider: string
          provider_team_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          provider_team_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_provider_mappings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          country: string
          id: string
          logo_url: string | null
          name: string
          short_name: string
        }
        Insert: {
          country: string
          id?: string
          logo_url?: string | null
          name: string
          short_name: string
        }
        Update: {
          country?: string
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string
        }
        Relationships: []
      }
      tracked_teams: {
        Row: {
          active: boolean
          created_at: string
          id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_sync_slot: {
        Args: { p_job: string; p_ttl_seconds: number }
        Returns: boolean
      }
      delete_user_account: { Args: { p_user_id: string }; Returns: Json }
      generate_leaguexi_rounds: {
        Args: { p_context_id: string }
        Returns: number
      }
      get_all_time_leaderboard: {
        Args: { p_caller_id?: string; p_league_id?: string; p_limit?: number }
        Returns: {
          avatar_url: string
          correct_outcomes: number
          correct_scores: number
          is_caller: boolean
          points: number
          rank: number
          user_id: string
          username: string
        }[]
      }
      get_leaderboard: {
        Args: { p_competition_id?: string }
        Returns: {
          avatar_url: string
          correct_results: number
          exact_scores: number
          member_since: string
          total_points: number
          user_id: string
          username: string
        }[]
      }
      get_league_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: {
          id: string
          is_archived: boolean
          slug: string
        }[]
      }
      get_league_for_page: {
        Args: { p_slug: string }
        Returns: {
          creator_user_id: string
          description: string
          id: string
          is_archived: boolean
          name: string
          prize_description: string
          slug: string
          visibility: string
        }[]
      }
      get_league_leaderboard: {
        Args: { p_competition_id?: string; p_league_id: string }
        Returns: {
          avatar_url: string
          correct_results: number
          exact_scores: number
          joined_at: string
          total_points: number
          user_id: string
          username: string
        }[]
      }
      get_league_predictions: {
        Args: {
          p_caller_id: string
          p_competition_id?: string
          p_league_id: string
        }
        Returns: {
          avatar_url: string
          away_score: number
          away_team_country: string
          away_team_name: string
          away_team_short: string
          fixture_id: string
          home_score: number
          home_team_country: string
          home_team_name: string
          home_team_short: string
          kickoff_at: string
          points: number
          predicted_away: number
          predicted_home: number
          round: string
          status: string
          user_id: string
          username: string
        }[]
      }
      get_round_leaderboard: {
        Args: {
          p_caller_id?: string
          p_league_id?: string
          p_limit?: number
          p_round_id: string
        }
        Returns: {
          avatar_url: string
          correct_outcomes: number
          correct_scores: number
          is_caller: boolean
          points: number
          rank: number
          user_id: string
          username: string
        }[]
      }
      get_season_leaderboard: {
        Args: {
          p_caller_id?: string
          p_league_id?: string
          p_limit?: number
          p_prediction_context_id: string
          p_season_id: string
        }
        Returns: {
          avatar_url: string
          correct_outcomes: number
          correct_scores: number
          is_caller: boolean
          points: number
          rank: number
          user_id: string
          username: string
        }[]
      }
      get_user_league_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_user_rank: {
        Args: { p_competition_id?: string; p_user_id: string }
        Returns: {
          correct_results: number
          exact_scores: number
          rank: number
          total_points: number
        }[]
      }
      is_league_open_for_joining: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      recalculate_leaderboards: {
        Args: { p_round_id: string }
        Returns: undefined
      }
      recalculate_match_predictions: {
        Args: { p_match_id: string }
        Returns: number
      }
      register_device_token: {
        Args: { p_platform?: string; p_token: string }
        Returns: undefined
      }
      release_sync_slot: { Args: { p_job: string }; Returns: undefined }
      transfer_league_ownership: {
        Args: {
          p_caller_id: string
          p_league_id: string
          p_new_owner_id: string
        }
        Returns: string
      }
    }
    Enums: {
      fixture_status:
        | "scheduled"
        | "live"
        | "finished"
        | "postponed"
        | "cancelled"
        | "abandoned"
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
      fixture_status: [
        "scheduled",
        "live",
        "finished",
        "postponed",
        "cancelled",
        "abandoned",
      ],
    },
  },
} as const
