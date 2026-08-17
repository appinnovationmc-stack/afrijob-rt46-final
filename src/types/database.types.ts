export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      compliance_documents: {
        Row: {
          created_at: string
          doc_type: Database["public"]["Enums"]["compliance_doc_type"]
          expiry_date: string | null
          id: string
          issued_date: string | null
          status: Database["public"]["Enums"]["compliance_status"]
          storage_path: string
          updated_at: string
          uploaded_by: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          doc_type: Database["public"]["Enums"]["compliance_doc_type"]
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          storage_path: string
          updated_at?: string
          uploaded_by: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          doc_type?: Database["public"]["Enums"]["compliance_doc_type"]
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
          workshop_id?: string
        }
        Relationships: [
          { foreignKeyName: "compliance_documents_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "compliance_documents_workshop_id_fkey"; columns: ["workshop_id"]; isOneToOne: false; referencedRelation: "workshops"; referencedColumns: ["id"] },
        ]
      }
      job_parts: {
        Row: {
          created_at: string
          id: string
          job_id: string
          part_name: string
          quantity: number
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          part_name: string
          quantity?: number
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          part_name?: string
          quantity?: number
          unit_cost?: number | null
        }
        Relationships: [
          { foreignKeyName: "job_parts_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
        ]
      }
      job_photos: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          job_id: string
          latitude: number | null
          longitude: number | null
          stage: Database["public"]["Enums"]["photo_stage"]
          storage_path: string
          taken_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          job_id: string
          latitude?: number | null
          longitude?: number | null
          stage: Database["public"]["Enums"]["photo_stage"]
          storage_path: string
          taken_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          job_id?: string
          latitude?: number | null
          longitude?: number | null
          stage?: Database["public"]["Enums"]["photo_stage"]
          storage_path?: string
          taken_at?: string
          uploaded_by?: string
        }
        Relationships: [
          { foreignKeyName: "job_photos_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
          { foreignKeyName: "job_photos_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      job_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          from_status: Database["public"]["Enums"]["job_status"] | null
          id: string
          job_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          changed_at?: string
          changed_by: string
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          { foreignKeyName: "job_status_history_changed_by_fkey"; columns: ["changed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "job_status_history_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
        ]
      }
      jobs: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          customer_signature_url: string | null
          description: string | null
          id: string
          internal_notes: string | null
          job_type: Database["public"]["Enums"]["job_type"]
          labour_hours: number | null
          odometer: number | null
          paid_at: string | null
          pdf_report_url: string | null
          priority: Database["public"]["Enums"]["job_priority"]
          status: Database["public"]["Enums"]["job_status"]
          submitted_at: string | null
          updated_at: string
          vehicle_colour: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_registration: string
          vehicle_vin: string | null
          workshop_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          customer_signature_url?: string | null
          description?: string | null
          id?: string
          internal_notes?: string | null
          job_type: Database["public"]["Enums"]["job_type"]
          labour_hours?: number | null
          odometer?: number | null
          paid_at?: string | null
          pdf_report_url?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          status?: Database["public"]["Enums"]["job_status"]
          submitted_at?: string | null
          updated_at?: string
          vehicle_colour?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration: string
          vehicle_vin?: string | null
          workshop_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          customer_signature_url?: string | null
          description?: string | null
          id?: string
          internal_notes?: string | null
          job_type?: Database["public"]["Enums"]["job_type"]
          labour_hours?: number | null
          odometer?: number | null
          paid_at?: string | null
          pdf_report_url?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          status?: Database["public"]["Enums"]["job_status"]
          submitted_at?: string | null
          updated_at?: string
          vehicle_colour?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_registration?: string
          vehicle_vin?: string | null
          workshop_id?: string
        }
        Relationships: [
          { foreignKeyName: "jobs_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "jobs_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "jobs_workshop_id_fkey"; columns: ["workshop_id"]; isOneToOne: false; referencedRelation: "workshops"; referencedColumns: ["id"] },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          profile_id: string
          read_at: string | null
          related_document_id: string | null
          related_job_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          workshop_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          profile_id: string
          read_at?: string | null
          related_document_id?: string | null
          related_job_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          workshop_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          read_at?: string | null
          related_document_id?: string | null
          related_job_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          workshop_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "notifications_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_related_document_id_fkey"; columns: ["related_document_id"]; isOneToOne: false; referencedRelation: "compliance_documents"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_related_job_id_fkey"; columns: ["related_job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_workshop_id_fkey"; columns: ["workshop_id"]; isOneToOne: false; referencedRelation: "workshops"; referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workshop_members: {
        Row: {
          id: string
          invited_at: string
          joined_at: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          workshop_id: string
        }
        Insert: {
          id?: string
          invited_at?: string
          joined_at?: string | null
          profile_id: string
          role?: Database["public"]["Enums"]["user_role"]
          workshop_id: string
        }
        Update: {
          id?: string
          invited_at?: string
          joined_at?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          workshop_id?: string
        }
        Relationships: [
          { foreignKeyName: "workshop_members_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "workshop_members_workshop_id_fkey"; columns: ["workshop_id"]; isOneToOne: false; referencedRelation: "workshops"; referencedColumns: ["id"] },
        ]
      }
      workshops: {
        Row: {
          address: string | null
          afrirent_merchant_code: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          afrirent_merchant_code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          afrirent_merchant_code?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "workshops_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_workshop_admin: { Args: { target_workshop_id: string }; Returns: boolean }
      is_workshop_member: { Args: { target_workshop_id: string }; Returns: boolean }
    }
    Enums: {
      compliance_doc_type: "cof" | "roadworthy_certificate" | "business_licence" | "insurance" | "tax_clearance" | "bbbee" | "other"
      compliance_status: "valid" | "expiring_soon" | "expired"
      job_priority: "normal" | "urgent"
      job_status: "draft" | "in_progress" | "waiting_for_parts" | "completed" | "submitted" | "paid"
      job_type: "service" | "mechanical_repair" | "panel_beating" | "towing" | "accident_repair" | "specialist" | "compliance" | "other"
      notification_type: "compliance_expiry" | "job_status_change" | "payment" | "system"
      photo_stage: "before" | "during" | "after"
      user_role: "owner" | "technician" | "admin"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
