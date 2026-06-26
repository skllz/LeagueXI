// ⚠️ Post-WC (Phase 1) hand-edited to match the renamed schema in
// supabase/migrations/post-wc/. The live DB is NOT yet migrated. Before cutover,
// REGENERATE this file from the migrated (staging) database:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
// Do not rely on hand edits long-term.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          is_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      competitions: {
        Row: {
          id: string
          name: string
          slug: string
          season: string
          starts_at: string
          ends_at: string
          is_active: boolean
          type: "domestic_league" | "domestic_cup" | "european" | "international" | null
          country: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          season: string
          starts_at: string
          ends_at: string
          is_active?: boolean
          type?: "domestic_league" | "domestic_cup" | "european" | "international" | null
          country?: string | null
        }
        Update: {
          name?: string
          slug?: string
          season?: string
          starts_at?: string
          ends_at?: string
          is_active?: boolean
          type?: "domestic_league" | "domestic_cup" | "european" | "international" | null
          country?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          name: string
          short_name: string
          country: string
          logo_url: string | null
        }
        Insert: {
          id?: string
          name: string
          short_name: string
          country: string
          logo_url?: string | null
        }
        Update: {
          name?: string
          short_name?: string
          country?: string
          logo_url?: string | null
        }
        Relationships: []
      }
      fixtures: {
        Row: {
          id: string
          competition_id: string
          home_team_id: string
          away_team_id: string
          kickoff_datetime_utc: string
          status: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
          home_score: number | null
          away_score: number | null
          round: string | null
          round_id: string | null
          season_id: string | null
          competition_name: string | null
          competition_type: string | null
          season_label: string | null
          is_friendly: boolean | null
          is_competitive: boolean | null
          is_included: boolean | null
          inclusion_source:
            | "allowlist"
            | "blocklist"
            | "admin_override"
            | "manual_import"
            | "provider_sync"
            | "unclassified"
            | null
          admin_include_override: boolean | null
          admin_exclude_override: boolean | null
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          competition_id: string
          home_team_id: string
          away_team_id: string
          kickoff_datetime_utc: string
          status?: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
          home_score?: number | null
          away_score?: number | null
          round?: string | null
          round_id?: string | null
          season_id?: string | null
          competition_name?: string | null
          competition_type?: string | null
          season_label?: string | null
          is_friendly?: boolean | null
          is_competitive?: boolean | null
          is_included?: boolean | null
          inclusion_source?:
            | "allowlist"
            | "blocklist"
            | "admin_override"
            | "manual_import"
            | "provider_sync"
            | "unclassified"
            | null
          admin_include_override?: boolean | null
          admin_exclude_override?: boolean | null
          last_synced_at?: string | null
        }
        Update: {
          competition_id?: string
          home_team_id?: string
          away_team_id?: string
          kickoff_datetime_utc?: string
          status?: "scheduled" | "live" | "finished" | "postponed" | "abandoned" | "cancelled"
          home_score?: number | null
          away_score?: number | null
          round?: string | null
          round_id?: string | null
          season_id?: string | null
          competition_name?: string | null
          competition_type?: string | null
          season_label?: string | null
          is_friendly?: boolean | null
          is_competitive?: boolean | null
          is_included?: boolean | null
          inclusion_source?:
            | "allowlist"
            | "blocklist"
            | "admin_override"
            | "manual_import"
            | "provider_sync"
            | "unclassified"
            | null
          admin_include_override?: boolean | null
          admin_exclude_override?: boolean | null
          last_synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_competition_id_fkey"
            columns: ["competition_id"]
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          }
        ]
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          fixture_id: string
          predicted_home_score: number
          predicted_away_score: number
          points: number | null
          is_locked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          fixture_id: string
          predicted_home_score: number
          predicted_away_score: number
          points?: number | null
          is_locked?: boolean
        }
        Update: {
          predicted_home_score?: number
          predicted_away_score?: number
          points?: number | null
          is_locked?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_fixture_id_fkey"
            columns: ["fixture_id"]
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          }
        ]
      }
      leagues: {
        Row: {
          id: string
          creator_user_id: string
          name: string
          slug: string
          invite_code: string
          description: string | null
          visibility: "public" | "private"
          logo_url: string | null
          prize_description: string | null
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_user_id: string
          name: string
          slug: string
          invite_code: string
          description?: string | null
          visibility?: "public" | "private"
          logo_url?: string | null
          prize_description?: string | null
          is_archived?: boolean
        }
        Update: {
          name?: string
          slug?: string
          creator_user_id?: string
          description?: string | null
          visibility?: "public" | "private"
          logo_url?: string | null
          prize_description?: string | null
          is_archived?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      league_members: {
        Row: {
          id: string
          league_id: string
          user_id: string
          role: "owner" | "admin" | "member"
          status: "active" | "removed" | "left"
          joined_at: string
        }
        Insert: {
          id?: string
          league_id: string
          user_id: string
          role?: "owner" | "admin" | "member"
          status?: "active" | "removed" | "left"
          joined_at?: string
        }
        Update: {
          role?: "owner" | "admin" | "member"
          status?: "active" | "removed" | "left"
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      seasons: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          status: "upcoming" | "active" | "completed" | "archived"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          start_date: string
          end_date: string
          status?: "upcoming" | "active" | "completed" | "archived"
        }
        Update: {
          name?: string
          start_date?: string
          end_date?: string
          status?: "upcoming" | "active" | "completed" | "archived"
          updated_at?: string
        }
        Relationships: []
      }
      prediction_contexts: {
        Row: {
          id: string
          name: string
          type: "standard_leaguexi" | "world_cup"
          season_id: string | null
          starts_at: string | null
          ends_at: string | null
          status: "upcoming" | "active" | "completed" | "archived"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: "standard_leaguexi" | "world_cup"
          season_id?: string | null
          starts_at?: string | null
          ends_at?: string | null
          status?: "upcoming" | "active" | "completed" | "archived"
        }
        Update: {
          name?: string
          type?: "standard_leaguexi" | "world_cup"
          season_id?: string | null
          starts_at?: string | null
          ends_at?: string | null
          status?: "upcoming" | "active" | "completed" | "archived"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_contexts_season_id_fkey"
            columns: ["season_id"]
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          }
        ]
      }
      leaguexi_rounds: {
        Row: {
          id: string
          round_number: number
          season_id: string
          prediction_context_id: string
          start_datetime: string
          end_datetime: string
          status:
            | "draft"
            | "open"
            | "in_progress"
            | "pending_finalization"
            | "finalized"
            | "empty"
            | "cancelled"
          finalized_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          round_number: number
          season_id: string
          prediction_context_id: string
          start_datetime: string
          end_datetime: string
          status?:
            | "draft"
            | "open"
            | "in_progress"
            | "pending_finalization"
            | "finalized"
            | "empty"
            | "cancelled"
          finalized_at?: string | null
        }
        Update: {
          round_number?: number
          start_datetime?: string
          end_datetime?: string
          status?:
            | "draft"
            | "open"
            | "in_progress"
            | "pending_finalization"
            | "finalized"
            | "empty"
            | "cancelled"
          finalized_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaguexi_rounds_season_id_fkey"
            columns: ["season_id"]
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaguexi_rounds_prediction_context_id_fkey"
            columns: ["prediction_context_id"]
            referencedRelation: "prediction_contexts"
            referencedColumns: ["id"]
          }
        ]
      }
      tracked_teams: {
        Row: {
          id: string
          team_id: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          active?: boolean
        }
        Update: {
          active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_teams_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          }
        ]
      }
      team_provider_mappings: {
        Row: {
          id: string
          team_id: string
          provider: "api_football" | "football_data_org" | "sportmonks"
          provider_team_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          provider: "api_football" | "football_data_org" | "sportmonks"
          provider_team_id: string
        }
        Update: {
          provider?: "api_football" | "football_data_org" | "sportmonks"
          provider_team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_provider_mappings_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          }
        ]
      }
      competition_provider_mappings: {
        Row: {
          id: string
          competition_id: string
          provider: "api_football" | "football_data_org" | "sportmonks"
          provider_competition_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          competition_id: string
          provider: "api_football" | "football_data_org" | "sportmonks"
          provider_competition_id: string
        }
        Update: {
          provider?: "api_football" | "football_data_org" | "sportmonks"
          provider_competition_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_provider_mappings_competition_id_fkey"
            columns: ["competition_id"]
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          }
        ]
      }
      fixture_provider_mappings: {
        Row: {
          id: string
          fixture_id: string
          provider: "api_football" | "football_data_org" | "sportmonks"
          provider_fixture_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fixture_id: string
          provider: "api_football" | "football_data_org" | "sportmonks"
          provider_fixture_id: string
        }
        Update: {
          provider?: "api_football" | "football_data_org" | "sportmonks"
          provider_fixture_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_provider_mappings_fixture_id_fkey"
            columns: ["fixture_id"]
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          }
        ]
      }
      sync_logs: {
        Row: {
          id: string
          sync_type: "fixture_discovery" | "match_result_sync"
          status: "success" | "failed" | "partial_success"
          started_at: string | null
          finished_at: string | null
          error_message: string | null
          records_processed: number | null
          provider: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sync_type: "fixture_discovery" | "match_result_sync"
          status: "success" | "failed" | "partial_success"
          started_at?: string | null
          finished_at?: string | null
          error_message?: string | null
          records_processed?: number | null
          provider?: string | null
        }
        Update: {
          status?: "success" | "failed" | "partial_success"
          finished_at?: string | null
          error_message?: string | null
          records_processed?: number | null
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          id: string
          severity: "info" | "warning" | "critical"
          alert_type: "sync_failure" | "sync_stale" | "provider_error" | "fixture_import_error"
          message: string
          related_sync_type: string | null
          is_read: boolean
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          severity: "info" | "warning" | "critical"
          alert_type: "sync_failure" | "sync_stale" | "provider_error" | "fixture_import_error"
          message: string
          related_sync_type?: string | null
          is_read?: boolean
          resolved_at?: string | null
        }
        Update: {
          is_read?: boolean
          resolved_at?: string | null
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          id: string
          user_id: string
          round_id: string | null
          season_id: string | null
          prediction_context_id: string
          league_id: string | null
          points: number
          correct_scores: number
          correct_outcomes: number
          rank: number | null
          calculated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          round_id?: string | null
          season_id?: string | null
          prediction_context_id: string
          league_id?: string | null
          points?: number
          correct_scores?: number
          correct_outcomes?: number
          rank?: number | null
          calculated_at?: string
        }
        Update: {
          points?: number
          correct_scores?: number
          correct_outcomes?: number
          rank?: number | null
          calculated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_round_id_fkey"
            columns: ["round_id"]
            referencedRelation: "leaguexi_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_season_id_fkey"
            columns: ["season_id"]
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_prediction_context_id_fkey"
            columns: ["prediction_context_id"]
            referencedRelation: "prediction_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_league_id_fkey"
            columns: ["league_id"]
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: { p_competition_id?: string | null }
        Returns: {
          user_id: string
          username: string
          avatar_url: string | null
          total_points: number
          exact_scores: number
          correct_results: number
          member_since: string
        }[]
      }
      get_league_leaderboard: {
        Args: { p_league_id: string; p_competition_id?: string | null }
        Returns: {
          user_id: string
          username: string
          avatar_url: string | null
          total_points: number
          exact_scores: number
          correct_results: number
          joined_at: string
        }[]
      }
      get_league_predictions: {
        Args: {
          p_league_id: string
          p_caller_id: string
          p_competition_id?: string | null
        }
        Returns: {
          fixture_id: string
          kickoff_at: string
          status: string
          home_score: number | null
          away_score: number | null
          home_team_name: string
          home_team_short: string
          home_team_country: string
          away_team_name: string
          away_team_short: string
          away_team_country: string
          round: string | null
          user_id: string
          username: string
          avatar_url: string | null
          predicted_home: number
          predicted_away: number
          points: number | null
        }[]
      }
      get_league_for_page: {
        Args: { p_slug: string }
        Returns: {
          id: string
          name: string
          slug: string
          description: string | null
          visibility: "public" | "private"
          prize_description: string | null
          is_archived: boolean
          creator_user_id: string
        }[]
      }
      get_league_by_invite_code: {
        Args: { p_invite_code: string }
        Returns: { id: string; slug: string; is_archived: boolean }[]
      }
      get_user_rank: {
        Args: { p_user_id: string; p_competition_id?: string | null }
        Returns: {
          total_points: number
          exact_scores: number
          correct_results: number
          rank: number
        }[]
      }
      transfer_league_ownership: {
        Args: {
          p_league_id: string
          p_caller_id: string
          p_new_owner_id: string
        }
        Returns: string
      }
      recalculate_match_predictions: {
        Args: { p_match_id: string }
        Returns: number
      }
      get_user_league_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      generate_leaguexi_rounds: {
        Args: { p_context_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
