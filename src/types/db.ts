/**
 * Hand-written types matching supabase/migrations/0001_init.sql.
 *
 * Shape mirrors what `supabase gen types typescript` produces for v2.49+
 * of @supabase/supabase-js — including `__InternalSupabase`, `Enums`,
 * `CompositeTypes`, and per-table `Relationships`. Without those fields the
 * generic on createServerClient/createBrowserClient collapses table Row/Insert
 * types to `never`.
 *
 * Replace with auto-generated types once the project is in CI:
 *   supabase gen types typescript --project-id YOUR_REF > src/types/db.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ====== Enums (stored as text with CHECK constraints) ============================

export type TodoCategory = "wedding" | "honeymoon" | "home" | "personal";
export type TodoPriority = "low" | "medium" | "high";

export type BudgetStatus = "pending" | "deposit" | "paid";

export type GuestSide = "bride" | "groom" | "both";
export type GuestRsvp = "pending" | "yes" | "no";

export type ApartmentStatus = "interested" | "visited" | "applied" | "rejected";

// ====== Row shapes ===============================================================

export interface TodoRow {
  id: string;
  text: string;
  category: TodoCategory;
  priority: TodoPriority;
  due_date: string | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgendaRow {
  id: string;
  title: string;
  date: string;            // ISO timestamp; midnight UTC if all_day
  all_day: boolean;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: string;
  name: string;
  category: string | null;
  status: BudgetStatus;
  vendor: string | null;
  estimated: number | null;
  paid: number | null;
  created_at: string;
  updated_at: string;
}

export interface HoneymoonRow {
  id: string;
  name: string;
  country: string | null;
  budget: number | null;
  duration: string | null;
  best_time: string | null;
  notes: string | null;
  link: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuestRow {
  id: string;
  name: string;
  side: GuestSide;
  category: string | null;
  plus_one: boolean;
  plus_one_name: string | null;
  rsvp: GuestRsvp;
  invited: boolean;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApartmentRow {
  id: string;
  title: string;
  address: string | null;
  rent: number | null;
  charges: number | null;
  size: number | null;
  bedrooms: number | null;
  pros: string | null;
  cons: string | null;
  status: ApartmentStatus;
  rating: number;
  link: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeddingDayEventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ====== Database type — supabase-js v2.49+ shape =================================

export type Database = {
  // Required by supabase-js v2.49+ for schema discrimination.
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      todos: {
        Row: TodoRow;
        Insert: {
          id?: string;
          text: string;
          category?: TodoCategory;
          priority?: TodoPriority;
          due_date?: string | null;
          done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          text?: string;
          category?: TodoCategory;
          priority?: TodoPriority;
          due_date?: string | null;
          done?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agenda: {
        Row: AgendaRow;
        Insert: {
          id?: string;
          title: string;
          date: string;
          all_day?: boolean;
          location?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          date?: string;
          all_day?: boolean;
          location?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget: {
        Row: BudgetRow;
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          status?: BudgetStatus;
          vendor?: string | null;
          estimated?: number | null;
          paid?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          status?: BudgetStatus;
          vendor?: string | null;
          estimated?: number | null;
          paid?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      honeymoon: {
        Row: HoneymoonRow;
        Insert: {
          id?: string;
          name: string;
          country?: string | null;
          budget?: number | null;
          duration?: string | null;
          best_time?: string | null;
          notes?: string | null;
          link?: string | null;
          favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          country?: string | null;
          budget?: number | null;
          duration?: string | null;
          best_time?: string | null;
          notes?: string | null;
          link?: string | null;
          favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guests: {
        Row: GuestRow;
        Insert: {
          id?: string;
          name: string;
          side?: GuestSide;
          category?: string | null;
          plus_one?: boolean;
          plus_one_name?: string | null;
          rsvp?: GuestRsvp;
          invited?: boolean;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          side?: GuestSide;
          category?: string | null;
          plus_one?: boolean;
          plus_one_name?: string | null;
          rsvp?: GuestRsvp;
          invited?: boolean;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      apartments: {
        Row: ApartmentRow;
        Insert: {
          id?: string;
          title: string;
          address?: string | null;
          rent?: number | null;
          charges?: number | null;
          size?: number | null;
          bedrooms?: number | null;
          pros?: string | null;
          cons?: string | null;
          status?: ApartmentStatus;
          rating?: number;
          link?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          address?: string | null;
          rent?: number | null;
          charges?: number | null;
          size?: number | null;
          bedrooms?: number | null;
          pros?: string | null;
          cons?: string | null;
          status?: ApartmentStatus;
          rating?: number;
          link?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wedding_day_events: {
        Row: WeddingDayEventRow;
        Insert: {
          id?: string;
          title: string;
          start_time: string;
          end_time: string;
          location?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          start_time?: string;
          end_time?: string;
          location?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      allowed_emails: {
        Row: { email: string; created_at: string };
        Insert: { email: string; created_at?: string };
        Update: { email?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_allowed: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
