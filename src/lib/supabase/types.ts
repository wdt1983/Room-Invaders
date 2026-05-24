/**
 * Database type definitions for Supabase.
 *
 * Will be auto-generated via `supabase gen types typescript` once
 * migrations are applied. For now, this is a placeholder that lets
 * the Supabase client be typed without blocking development.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Populated after migrations 00001-00003 (tasks 0.0.8-0.0.10)
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      [key: string]: string;
    };
  };
}
