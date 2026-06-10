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
        }
        Insert: {
          id?: string
          name: string
          slug: string
          season: string
          starts_at: string
          ends_at: string
          is_active?: boolean
        }
        Update: {
          name?: string
          slug?: string
          season?: string
          starts_at?: string
          ends_at?: string
          is_active?: boolean
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
      matches: {
        Row: {
          id: string
          competition_id: string
          home_team_id: string
          away_team_id: string
          kickoff_at: string
          status: "scheduled" | "live" | "completed" | "postponed" | "cancelled"
          home_score: number | null
          away_score: number | null
          round: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          competition_id: string
          home_team_id: string
          away_team_id: string
          kickoff_at: string
          status?: "scheduled" | "live" | "completed" | "postponed" | "cancelled"
          home_score?: number | null
          away_score?: number | null
          round?: string | null
        }
        Update: {
          competition_id?: string
          home_team_id?: string
          away_team_id?: string
          kickoff_at?: string
          status?: "scheduled" | "live" | "completed" | "postponed" | "cancelled"
          home_score?: number | null
          away_score?: number | null
          round?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
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
          match_id: string
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
          match_id: string
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
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            referencedRelation: "matches"
            referencedColumns: ["id"]
          }
        ]
      }
      leagues: {
        Row: {
          id: string
          competition_id: string | null
          owner_id: string
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
          competition_id?: string | null
          owner_id: string
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
          owner_id?: string
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
          role: "owner" | "member"
          joined_at: string
        }
        Insert: {
          id?: string
          league_id: string
          user_id: string
          role?: "owner" | "member"
          joined_at?: string
        }
        Update: {
          role?: "owner" | "member"
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
          match_id: string
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
