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
export type BudgetPayer = "bride" | "groom" | "both";

export type GuestSide = "bride" | "groom" | "both";
export type GuestRsvp = "pending" | "yes" | "no";

export type ApartmentStatus = "interested" | "visited" | "applied" | "rejected";

export type SavingsContributor = "bride" | "groom" | "both";

export type LifePerson = "bride" | "groom" | "both";
/** Who pays an expense or purchase. "gift" (covered by someone else) and "free"
 *  both mean it costs the couple nothing, so they don't affect the projection. */
export type ExpensePayer = LifePerson | "gift" | "free";
export type StartingCashMode = "manual" | "from_wedding";
export type ExpenseType = "fixed" | "credit";

export interface ExpenseBreakdownItem {
  label: string;
  amount: number;
}

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
  payer: BudgetPayer;
  payer_groom_pct: number | null;
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
  start_date: string | null;
  end_date: string | null;
  images: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestRow {
  id: string;
  name: string;
  side: GuestSide;
  category: string | null;
  /** Free-form group the guest belongs to ("Uni friends", "Work", …). */
  guest_group: string | null;
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

export type WeddingDayAssignee = "bride" | "groom" | "both";

export interface WeddingSavingsRow {
  id: string;
  amount: number;
  saved_on: string; // YYYY-MM-DD
  source: string | null;
  notes: string | null;
  contributor: SavingsContributor;
  created_at: string;
  updated_at: string;
}

export interface LifeIncomeRow {
  id: string;
  name: string;
  amount: number;
  person: LifePerson;
  start_month: string | null;
  end_month: string | null;
  day_of_month: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LifeExpenseRow {
  id: string;
  name: string;
  amount: number;
  category: string | null;
  payer: ExpensePayer;
  payer_groom_pct: number | null;
  start_month: string | null;
  end_month: string | null;
  expense_type: ExpenseType;
  credit_total: number | null;
  credit_months: number | null;
  credit_interest_rate: number | null;
  day_of_month: number | null;
  notes: string | null;
  breakdown_items: ExpenseBreakdownItem[];
  created_at: string;
  updated_at: string;
}

export interface LifePurchaseRow {
  id: string;
  name: string;
  amount: number;
  already_paid: number;
  category: string | null;
  target_month: string;
  payer: ExpensePayer;
  payer_groom_pct: number | null;
  scheduled: boolean;
  day_of_month: number | null;
  selected_option_id: string | null;
  notes: string | null;
  breakdown_items: ExpenseBreakdownItem[];
  created_at: string;
  updated_at: string;
}

export interface LifePurchaseOptionRow {
  id: string;
  purchase_id: string;
  label: string;
  amount: number;
  link: string | null;
  notes: string | null;
  groom_like: boolean;
  bride_like: boolean;
  created_at: string;
  updated_at: string;
}

export interface LifeSettingsRow {
  id: boolean;
  start_month: string;
  horizon_months: number;
  starting_cash_mode: StartingCashMode;
  starting_cash_manual: number;
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
  assignee: WeddingDayAssignee;
  created_at: string;
  updated_at: string;
}

// ====== Trip Scenario Planner (Honeymoon tab) ===================================

/** Pastel color tokens for scenario badges (kept off the main palette). */
export type ScenarioColor =
  | "sage"
  | "blush"
  | "sky"
  | "lavender"
  | "sand"
  | "mint"
  | "peach";

/** Booking platforms with color-coded badges; "Other" is the catch-all. */
export type AccommodationPlatform =
  | "Booking"
  | "Airbnb"
  | "TripAdvisor"
  | "Other";

export interface TripScenarioRow {
  id: string;
  name: string;
  description: string | null;
  is_selected: boolean;
  promo_code: string | null;
  promo_amount: number;
  color: ScenarioColor;
  created_at: string;
  updated_at: string;
}

export interface TripStageRow {
  id: string;
  scenario_id: string;
  order_index: number;
  name: string;
  destination: string | null;
  nights: number;
  date_from: string | null;
  date_to: string | null;
  notes: string | null;
  emoji: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageAccommodationRow {
  id: string;
  stage_id: string;
  name: string;
  platform: AccommodationPlatform;
  url: string | null;
  price_total: number | null;
  price_per_night: number | null;
  rating: number | null;
  rating_count: number | null;
  breakfast: boolean;
  pool: boolean;
  ac: boolean;
  halal_nearby: boolean;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  is_chosen: boolean;
  image_url: string | null;
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
          payer?: BudgetPayer;
          payer_groom_pct?: number | null;
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
          payer?: BudgetPayer;
          payer_groom_pct?: number | null;
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
          guest_group?: string | null;
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
          guest_group?: string | null;
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
          assignee?: WeddingDayAssignee;
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
          assignee?: WeddingDayAssignee;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wedding_savings: {
        Row: WeddingSavingsRow;
        Insert: {
          id?: string;
          amount: number;
          saved_on?: string;
          source?: string | null;
          notes?: string | null;
          contributor?: SavingsContributor;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          amount?: number;
          saved_on?: string;
          source?: string | null;
          notes?: string | null;
          contributor?: SavingsContributor;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      life_income: {
        Row: LifeIncomeRow;
        Insert: {
          id?: string;
          name: string;
          amount: number;
          person?: LifePerson;
          start_month?: string | null;
          end_month?: string | null;
          day_of_month?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          amount?: number;
          person?: LifePerson;
          start_month?: string | null;
          end_month?: string | null;
          day_of_month?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      life_expenses: {
        Row: LifeExpenseRow;
        Insert: {
          id?: string;
          name: string;
          amount: number;
          category?: string | null;
          payer?: ExpensePayer;
          payer_groom_pct?: number | null;
          start_month?: string | null;
          end_month?: string | null;
          expense_type?: ExpenseType;
          credit_total?: number | null;
          credit_months?: number | null;
          credit_interest_rate?: number | null;
          day_of_month?: number | null;
          notes?: string | null;
          breakdown_items?: ExpenseBreakdownItem[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          amount?: number;
          category?: string | null;
          payer?: ExpensePayer;
          payer_groom_pct?: number | null;
          start_month?: string | null;
          end_month?: string | null;
          expense_type?: ExpenseType;
          credit_total?: number | null;
          credit_months?: number | null;
          credit_interest_rate?: number | null;
          day_of_month?: number | null;
          notes?: string | null;
          breakdown_items?: ExpenseBreakdownItem[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      life_purchases: {
        Row: LifePurchaseRow;
        Insert: {
          id?: string;
          name: string;
          amount: number;
          already_paid?: number;
          category?: string | null;
          target_month: string;
          payer?: ExpensePayer;
          payer_groom_pct?: number | null;
          scheduled?: boolean;
          day_of_month?: number | null;
          selected_option_id?: string | null;
          notes?: string | null;
          breakdown_items?: ExpenseBreakdownItem[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          amount?: number;
          already_paid?: number;
          category?: string | null;
          target_month?: string;
          payer?: ExpensePayer;
          payer_groom_pct?: number | null;
          scheduled?: boolean;
          day_of_month?: number | null;
          selected_option_id?: string | null;
          notes?: string | null;
          breakdown_items?: ExpenseBreakdownItem[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      life_purchase_options: {
        Row: LifePurchaseOptionRow;
        Insert: {
          id?: string;
          purchase_id: string;
          label: string;
          amount: number;
          link?: string | null;
          notes?: string | null;
          groom_like?: boolean;
          bride_like?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          purchase_id?: string;
          label?: string;
          amount?: number;
          link?: string | null;
          notes?: string | null;
          groom_like?: boolean;
          bride_like?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      life_settings: {
        Row: LifeSettingsRow;
        Insert: {
          id?: boolean;
          start_month?: string;
          horizon_months?: number;
          starting_cash_mode?: StartingCashMode;
          starting_cash_manual?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          start_month?: string;
          horizon_months?: number;
          starting_cash_mode?: StartingCashMode;
          starting_cash_manual?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trip_scenarios: {
        Row: TripScenarioRow;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_selected?: boolean;
          promo_code?: string | null;
          promo_amount?: number;
          color?: ScenarioColor;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_selected?: boolean;
          promo_code?: string | null;
          promo_amount?: number;
          color?: ScenarioColor;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      trip_stages: {
        Row: TripStageRow;
        Insert: {
          id?: string;
          scenario_id: string;
          order_index?: number;
          name: string;
          destination?: string | null;
          nights?: number;
          date_from?: string | null;
          date_to?: string | null;
          notes?: string | null;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          scenario_id?: string;
          order_index?: number;
          name?: string;
          destination?: string | null;
          nights?: number;
          date_from?: string | null;
          date_to?: string | null;
          notes?: string | null;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_stages_scenario_id_fkey";
            columns: ["scenario_id"];
            isOneToOne: false;
            referencedRelation: "trip_scenarios";
            referencedColumns: ["id"];
          }
        ];
      };
      stage_accommodations: {
        Row: StageAccommodationRow;
        Insert: {
          id?: string;
          stage_id: string;
          name: string;
          platform?: AccommodationPlatform;
          url?: string | null;
          price_total?: number | null;
          price_per_night?: number | null;
          rating?: number | null;
          rating_count?: number | null;
          breakfast?: boolean;
          pool?: boolean;
          ac?: boolean;
          halal_nearby?: boolean;
          pros?: string | null;
          cons?: string | null;
          notes?: string | null;
          is_chosen?: boolean;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          stage_id?: string;
          name?: string;
          platform?: AccommodationPlatform;
          url?: string | null;
          price_total?: number | null;
          price_per_night?: number | null;
          rating?: number | null;
          rating_count?: number | null;
          breakfast?: boolean;
          pool?: boolean;
          ac?: boolean;
          halal_nearby?: boolean;
          pros?: string | null;
          cons?: string | null;
          notes?: string | null;
          is_chosen?: boolean;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stage_accommodations_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: false;
            referencedRelation: "trip_stages";
            referencedColumns: ["id"];
          }
        ];
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
