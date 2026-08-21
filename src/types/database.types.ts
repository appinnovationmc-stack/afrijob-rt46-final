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
      asset_types: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          label: string
          organisation_id: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          label: string
          organisation_id?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          label?: string
          organisation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_types_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_number: string | null
          asset_type_id: string | null
          business_unit_id: string | null
          commissioned_at: string | null
          created_at: string
          id: string
          manufacturer: string | null
          metadata: Json
          meter_type: Database["public"]["Enums"]["asset_meter_type"]
          meter_value: number | null
          model: string | null
          organisation_id: string
          registration: string | null
          retired_at: string | null
          serial_number: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          asset_number?: string | null
          asset_type_id?: string | null
          business_unit_id?: string | null
          commissioned_at?: string | null
          created_at?: string
          id?: string
          manufacturer?: string | null
          metadata?: Json
          meter_type?: Database["public"]["Enums"]["asset_meter_type"]
          meter_value?: number | null
          model?: string | null
          organisation_id: string
          registration?: string | null
          retired_at?: string | null
          serial_number?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          asset_number?: string | null
          asset_type_id?: string | null
          business_unit_id?: string | null
          commissioned_at?: string | null
          created_at?: string
          id?: string
          manufacturer?: string | null
          metadata?: Json
          meter_type?: Database["public"]["Enums"]["asset_meter_type"]
          meter_value?: number | null
          model?: string | null
          organisation_id?: string
          registration?: string | null
          retired_at?: string | null
          serial_number?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          created_at: string
          external_account_ref: string | null
          id: string
          organisation_id: string
          plan: string
          provider: Database["public"]["Enums"]["billing_provider"]
          status: Database["public"]["Enums"]["billing_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_account_ref?: string | null
          id?: string
          organisation_id: string
          plan?: string
          provider?: Database["public"]["Enums"]["billing_provider"]
          status?: Database["public"]["Enums"]["billing_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_account_ref?: string | null
          id?: string
          organisation_id?: string
          plan?: string
          provider?: Database["public"]["Enums"]["billing_provider"]
          status?: Database["public"]["Enums"]["billing_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          created_at: string
          id: string
          name: string
          organisation_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organisation_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organisation_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_units_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_units_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organisation_id: string
          role: Database["public"]["Enums"]["organisation_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organisation_id: string
          role?: Database["public"]["Enums"]["organisation_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organisation_id?: string
          role?: Database["public"]["Enums"]["organisation_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          {
            foreignKeyName: "compliance_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      document_vault: {
        Row: {
          created_at: string
          doc_type: string
          entity_id: string
          entity_type: string
          expiry_date: string | null
          id: string
          issued_date: string | null
          organisation_id: string
          rejection_reason: string | null
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          entity_id: string
          entity_type: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          organisation_id: string
          rejection_reason?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          entity_id?: string
          entity_type?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          organisation_id?: string
          rejection_reason?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_vault_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_vault_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_vault_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          asset_id: string | null
          category: string
          created_at: string
          description: string
          id: string
          latitude: number | null
          linked_work_order_id: string | null
          longitude: number | null
          metadata: Json
          occurred_at: string
          organisation_id: string
          reported_by: string | null
          resolved_at: string | null
          severity: string
          site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          latitude?: number | null
          linked_work_order_id?: string | null
          longitude?: number | null
          metadata?: Json
          occurred_at?: string
          organisation_id: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          latitude?: number | null
          linked_work_order_id?: string | null
          longitude?: number | null
          metadata?: Json
          occurred_at?: string
          organisation_id?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_linked_work_order_id_fkey"
            columns: ["linked_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          organisation_id: string
          quantity_on_hand: number
          reorder_point: number | null
          site_id: string | null
          sku: string | null
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          organisation_id: string
          quantity_on_hand?: number
          reorder_point?: number | null
          site_id?: string | null
          sku?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          organisation_id?: string
          quantity_on_hand?: number
          reorder_point?: number | null
          site_id?: string | null
          sku?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          inventory_item_id: string
          movement_type: string
          note: string | null
          organisation_id: string
          quantity: number
          unit_cost: number | null
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id: string
          movement_type: string
          note?: string | null
          organisation_id: string
          quantity: number
          unit_cost?: number | null
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_item_id?: string
          movement_type?: string
          note?: string | null
          organisation_id?: string
          quantity?: number
          unit_cost?: number | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_parts: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          job_id: string
          part_name: string
          quantity: number
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          job_id: string
          part_name: string
          quantity?: number
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          job_id?: string
          part_name?: string
          quantity?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_parts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "job_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          created_at: string
          created_by: string
          customer_signature_url: string | null
          description: string | null
          generic_work_order_id: string | null
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
          asset_id?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by: string
          customer_signature_url?: string | null
          description?: string | null
          generic_work_order_id?: string | null
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
          asset_id?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          customer_signature_url?: string | null
          description?: string | null
          generic_work_order_id?: string | null
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
          {
            foreignKeyName: "jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_generic_work_order_id_fkey"
            columns: ["generic_work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedule_runs: {
        Row: {
          created_at: string
          due_at: string
          id: string
          organisation_id: string
          schedule_id: string
          status: string
          triggered_at: string | null
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          due_at: string
          id?: string
          organisation_id: string
          schedule_id: string
          status: string
          triggered_at?: string | null
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          due_at?: string
          id?: string
          organisation_id?: string
          schedule_id?: string
          status?: string
          triggered_at?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedule_runs_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedule_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedule_runs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          active: boolean
          asset_id: string
          created_at: string
          default_priority: Database["public"]["Enums"]["work_order_priority"]
          description: string | null
          fixed_date: string | null
          id: string
          interval_value: number | null
          last_run_at: string | null
          last_run_meter_reading: number | null
          name: string
          next_due_at: string | null
          next_due_meter_reading: number | null
          organisation_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_id: string
          created_at?: string
          default_priority?: Database["public"]["Enums"]["work_order_priority"]
          description?: string | null
          fixed_date?: string | null
          id?: string
          interval_value?: number | null
          last_run_at?: string | null
          last_run_meter_reading?: number | null
          name: string
          next_due_at?: string | null
          next_due_meter_reading?: number | null
          organisation_id: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_id?: string
          created_at?: string
          default_priority?: Database["public"]["Enums"]["work_order_priority"]
          description?: string | null
          fixed_date?: string | null
          id?: string
          interval_value?: number | null
          last_run_at?: string | null
          last_run_meter_reading?: number | null
          name?: string
          next_due_at?: string | null
          next_due_meter_reading?: number | null
          organisation_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          enabled: boolean
          notification_type: Database["public"]["Enums"]["notification_type"]
          profile_id: string
        }
        Insert: {
          channel: string
          enabled?: boolean
          notification_type: Database["public"]["Enums"]["notification_type"]
          profile_id: string
        }
        Update: {
          channel?: string
          enabled?: boolean
          notification_type?: Database["public"]["Enums"]["notification_type"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link_entity_id: string | null
          link_entity_type: string | null
          organisation_id: string
          read_at: string | null
          recipient_profile_id: string
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
          link_entity_id?: string | null
          link_entity_type?: string | null
          organisation_id: string
          read_at?: string | null
          recipient_profile_id: string
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
          link_entity_id?: string | null
          link_entity_type?: string | null
          organisation_id?: string
          read_at?: string | null
          recipient_profile_id?: string
          related_document_id?: string | null
          related_job_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "compliance_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          organisation_id: string
          profile_id: string
          role: Database["public"]["Enums"]["organisation_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          organisation_id: string
          profile_id: string
          role?: Database["public"]["Enums"]["organisation_role"]
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          organisation_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["organisation_role"]
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          enabled_modules: Json
          id: string
          industry_mode: Database["public"]["Enums"]["industry_mode"]
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_modules?: Json
          id?: string
          industry_mode?: Database["public"]["Enums"]["industry_mode"]
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_modules?: Json
          id?: string
          industry_mode?: Database["public"]["Enums"]["industry_mode"]
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          code: string
          description: string
          module: string
        }
        Insert: {
          code: string
          description: string
          module: string
        }
        Update: {
          code?: string
          description?: string
          module?: string
        }
        Relationships: []
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
      purchase_order_items: {
        Row: {
          created_at: string
          description: string
          id: string
          inventory_item_id: string | null
          purchase_order_id: string
          quantity: number
          received_quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          inventory_item_id?: string | null
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          inventory_item_id?: string | null
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          organisation_id: string
          requested_by: string | null
          site_id: string | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          organisation_id: string
          requested_by?: string | null
          site_id?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          organisation_id?: string
          requested_by?: string | null
          site_id?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          granted: boolean
          permission_code: string
          role: Database["public"]["Enums"]["organisation_role"]
        }
        Insert: {
          granted?: boolean
          permission_code: string
          role: Database["public"]["Enums"]["organisation_role"]
        }
        Update: {
          granted?: boolean
          permission_code?: string
          role?: Database["public"]["Enums"]["organisation_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      service_provider_capabilities: {
        Row: {
          capability: Database["public"]["Enums"]["service_provider_type"]
          created_at: string
          id: string
          service_category: string | null
          service_provider_id: string
        }
        Insert: {
          capability: Database["public"]["Enums"]["service_provider_type"]
          created_at?: string
          id?: string
          service_category?: string | null
          service_provider_id: string
        }
        Update: {
          capability?: Database["public"]["Enums"]["service_provider_type"]
          created_at?: string
          id?: string
          service_category?: string | null
          service_provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_provider_capabilities_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          legal_name: string | null
          metadata: Json
          organisation_id: string | null
          primary_type: Database["public"]["Enums"]["service_provider_type"]
          regions: string[]
          registration_number: string | null
          status: Database["public"]["Enums"]["service_provider_status"]
          trading_name: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          metadata?: Json
          organisation_id?: string | null
          primary_type?: Database["public"]["Enums"]["service_provider_type"]
          regions?: string[]
          registration_number?: string | null
          status?: Database["public"]["Enums"]["service_provider_status"]
          trading_name: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          metadata?: Json
          organisation_id?: string | null
          primary_type?: Database["public"]["Enums"]["service_provider_type"]
          regions?: string[]
          registration_number?: string | null
          status?: Database["public"]["Enums"]["service_provider_status"]
          trading_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          business_unit_id: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_unit_id?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_unit_id?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_breaches: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          breached_at: string
          created_at: string
          id: string
          metric: string
          minutes_over: number
          organisation_id: string
          sla_target_id: string
          work_order_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          breached_at?: string
          created_at?: string
          id?: string
          metric: string
          minutes_over: number
          organisation_id: string
          sla_target_id: string
          work_order_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          breached_at?: string
          created_at?: string
          id?: string
          metric?: string
          minutes_over?: number
          organisation_id?: string
          sla_target_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_breaches_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_sla_target_id_fkey"
            columns: ["sla_target_id"]
            isOneToOne: false
            referencedRelation: "sla_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          active: boolean
          business_unit_id: string | null
          category: Database["public"]["Enums"]["work_order_category"] | null
          created_at: string
          id: string
          name: string
          organisation_id: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_unit_id?: string | null
          category?: Database["public"]["Enums"]["work_order_category"] | null
          created_at?: string
          id?: string
          name: string
          organisation_id: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_unit_id?: string | null
          category?: Database["public"]["Enums"]["work_order_category"] | null
          created_at?: string
          id?: string
          name?: string
          organisation_id?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_policies_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_policies_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policy_targets: {
        Row: {
          id: string
          policy_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          resolution_minutes: number
          response_minutes: number
        }
        Insert: {
          id?: string
          policy_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          resolution_minutes: number
          response_minutes: number
        }
        Update: {
          id?: string
          policy_id?: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          resolution_minutes?: number
          response_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_policy_targets_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_targets: {
        Row: {
          created_at: string
          id: string
          organisation_id: string
          policy_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          resolution_due_at: string
          resolution_status: string
          resolved_at: string | null
          responded_at: string | null
          response_due_at: string
          response_status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organisation_id: string
          policy_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          resolution_due_at: string
          resolution_status?: string
          resolved_at?: string | null
          responded_at?: string | null
          response_due_at: string
          response_status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organisation_id?: string
          policy_id?: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          resolution_due_at?: string
          resolution_status?: string
          resolved_at?: string | null
          responded_at?: string | null
          response_due_at?: string
          response_status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_targets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_targets_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_targets_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          categories: string[]
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          legal_name: string | null
          metadata: Json
          organisation_id: string
          rating: number | null
          registration_number: string | null
          status: string
          trading_name: string
          updated_at: string
        }
        Insert: {
          categories?: string[]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          metadata?: Json
          organisation_id: string
          rating?: number | null
          registration_number?: string | null
          status?: string
          trading_name: string
          updated_at?: string
        }
        Update: {
          categories?: string[]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          metadata?: Json
          organisation_id?: string
          rating?: number | null
          registration_number?: string | null
          status?: string
          trading_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_cost: number | null
          asset_id: string | null
          assignee_profile_id: string | null
          category: Database["public"]["Enums"]["work_order_category"]
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          estimated_value: number | null
          id: string
          organisation_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          requester_profile_id: string | null
          service_provider_id: string | null
          site_id: string | null
          source_record_id: string | null
          source_system: string
          status: Database["public"]["Enums"]["work_order_generic_status"]
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          asset_id?: string | null
          assignee_profile_id?: string | null
          category?: Database["public"]["Enums"]["work_order_category"]
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          estimated_value?: number | null
          id?: string
          organisation_id: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          requester_profile_id?: string | null
          service_provider_id?: string | null
          site_id?: string | null
          source_record_id?: string | null
          source_system?: string
          status?: Database["public"]["Enums"]["work_order_generic_status"]
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          asset_id?: string | null
          assignee_profile_id?: string | null
          category?: Database["public"]["Enums"]["work_order_category"]
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          estimated_value?: number | null
          id?: string
          organisation_id?: string
          priority?: Database["public"]["Enums"]["work_order_priority"]
          requester_profile_id?: string | null
          service_provider_id?: string | null
          site_id?: string | null
          source_record_id?: string | null
          source_system?: string
          status?: Database["public"]["Enums"]["work_order_generic_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_assignee_profile_id_fkey"
            columns: ["assignee_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "workshop_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_members_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
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
          organisation_id: string
          owner_id: string
          service_provider_id: string | null
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
          organisation_id: string
          owner_id: string
          service_provider_id?: string | null
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
          organisation_id?: string
          owner_id?: string
          service_provider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshops_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      work_order_parts_unified: {
        Row: {
          id: string
          source: string
          work_order_id: string
          organisation_id: string
          asset_id: string | null
          job_id: string | null
          description: string
          inventory_item_id: string | null
          quantity: number
          unit_cost: number | null
          line_total: number
          created_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      approve_purchase_order: {
        Args: { p_po_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          organisation_id: string
          requested_by: string | null
          site_id: string | null
          status: string
          supplier_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "purchase_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_sla_to_work_order: {
        Args: { p_work_order_id: string }
        Returns: {
          created_at: string
          id: string
          organisation_id: string
          policy_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          resolution_due_at: string
          resolution_status: string
          resolved_at: string | null
          responded_at: string | null
          response_due_at: string
          response_status: string
          updated_at: string
          work_order_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sla_targets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_document_status: {
        Args: { p_expiry_date: string }
        Returns: string
      }
      escalate_incident_to_work_order: {
        Args: {
          p_incident_id: string
          p_priority?: Database["public"]["Enums"]["work_order_priority"]
        }
        Returns: {
          actual_cost: number | null
          asset_id: string | null
          assignee_profile_id: string | null
          category: Database["public"]["Enums"]["work_order_category"]
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          estimated_value: number | null
          id: string
          organisation_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          requester_profile_id: string | null
          service_provider_id: string | null
          site_id: string | null
          source_record_id: string | null
          source_system: string
          status: Database["public"]["Enums"]["work_order_generic_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_permission: {
        Args: { p_organisation_id: string; p_permission_code: string }
        Returns: boolean
      }
      accept_organisation_invitation: {
        Args: { p_token: string }
        Returns: {
          organisation_id: string
          role: Database["public"]["Enums"]["organisation_role"]
        }[]
      }
      is_org_admin: { Args: { p_organisation_id: string }; Returns: boolean }
      is_org_member: { Args: { p_organisation_id: string }; Returns: boolean }
      is_workshop_admin: {
        Args: { target_workshop_id: string }
        Returns: boolean
      }
      is_workshop_member: {
        Args: { target_workshop_id: string }
        Returns: boolean
      }
      notify: {
        Args: {
          p_body?: string
          p_link_entity_id?: string
          p_link_entity_type?: string
          p_organisation_id: string
          p_recipient_profile_id: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: {
          body: string | null
          created_at: string
          id: string
          link_entity_id: string | null
          link_entity_type: string | null
          organisation_id: string
          read_at: string | null
          recipient_profile_id: string
          related_document_id: string | null
          related_job_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          workshop_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      receive_purchase_order_item: {
        Args: { p_po_item_id: string; p_quantity: number }
        Returns: {
          created_at: string
          description: string
          id: string
          inventory_item_id: string | null
          purchase_order_id: string
          quantity: number
          received_quantity: number
          unit_cost: number
        }
        SetofOptions: {
          from: "*"
          to: "purchase_order_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_sla_resolution: {
        Args: { p_work_order_id: string }
        Returns: {
          created_at: string
          id: string
          organisation_id: string
          policy_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          resolution_due_at: string
          resolution_status: string
          resolved_at: string | null
          responded_at: string | null
          response_due_at: string
          response_status: string
          updated_at: string
          work_order_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sla_targets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_sla_response: {
        Args: { p_work_order_id: string }
        Returns: {
          created_at: string
          id: string
          organisation_id: string
          policy_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          resolution_due_at: string
          resolution_status: string
          resolved_at: string | null
          responded_at: string | null
          response_due_at: string
          response_status: string
          updated_at: string
          work_order_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sla_targets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_document_vault_statuses: { Args: never; Returns: number }
      run_due_maintenance_schedules: {
        Args: { p_organisation_id: string }
        Returns: {
          created_at: string
          due_at: string
          id: string
          organisation_id: string
          schedule_id: string
          status: string
          triggered_at: string | null
          work_order_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "maintenance_schedule_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      run_sla_breach_sweep: {
        Args: { p_organisation_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          breached_at: string
          created_at: string
          id: string
          metric: string
          minutes_over: number
          organisation_id: string
          sla_target_id: string
          work_order_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sla_breaches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      trigger_maintenance_schedule: {
        Args: {
          p_priority?: Database["public"]["Enums"]["work_order_priority"]
          p_schedule_id: string
        }
        Returns: {
          actual_cost: number | null
          asset_id: string | null
          assignee_profile_id: string | null
          category: Database["public"]["Enums"]["work_order_category"]
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          estimated_value: number | null
          id: string
          organisation_id: string
          priority: Database["public"]["Enums"]["work_order_priority"]
          requester_profile_id: string | null
          service_provider_id: string | null
          site_id: string | null
          source_record_id: string | null
          source_system: string
          status: Database["public"]["Enums"]["work_order_generic_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "work_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      asset_meter_type: "odometer" | "hours" | "none"
      asset_status:
        | "acquired"
        | "commissioned"
        | "active"
        | "under_maintenance"
        | "retired"
        | "disposed"
      billing_provider: "none" | "usc_pay" | "stripe" | "manual_invoice"
      billing_status: "trial" | "active" | "past_due" | "cancelled"
      compliance_doc_type:
        | "cof"
        | "roadworthy_certificate"
        | "business_licence"
        | "insurance"
        | "tax_clearance"
        | "bbbee"
        | "other"
      compliance_status: "valid" | "expiring_soon" | "expired"
      industry_mode:
        | "general"
        | "mining"
        | "fleet"
        | "municipal"
        | "government"
        | "logistics"
      job_priority: "normal" | "urgent"
      job_status:
        | "draft"
        | "in_progress"
        | "waiting_for_parts"
        | "completed"
        | "submitted"
        | "paid"
      job_type:
        | "service"
        | "mechanical_repair"
        | "panel_beating"
        | "towing"
        | "accident_repair"
        | "specialist"
        | "compliance"
        | "other"
      notification_type:
        | "compliance_expiry"
        | "job_status_change"
        | "payment"
        | "system"
        | "insurance_alert"
        | "merchant_suspended"
        | "merchant_reactivated"
        | "work_order_assigned"
        | "work_order_status_changed"
        | "purchase_order_approval_needed"
        | "purchase_order_approved"
        | "document_expiring"
        | "document_expired"
        | "incident_reported"
        | "incident_escalated"
        | "maintenance_due"
        | "low_stock"
        | "generic"
      organisation_role:
        | "owner"
        | "admin"
        | "manager"
        | "member"
        | "viewer"
        | "supervisor"
        | "technician"
        | "inspector"
        | "procurement_officer"
        | "finance"
        | "fleet_manager"
        | "operations_manager"
        | "contractor"
      photo_stage: "before" | "during" | "after"
      service_provider_status:
        | "pending_onboarding"
        | "active"
        | "suspended"
        | "terminated"
      service_provider_type:
        | "workshop"
        | "contractor"
        | "maintenance_provider"
        | "supplier"
        | "technician_org"
        | "other"
      user_role: "owner" | "technician" | "admin"
      work_order_category:
        | "breakdown"
        | "maintenance"
        | "inspection"
        | "repair"
        | "service"
        | "incident"
        | "other"
      work_order_generic_status:
        | "draft"
        | "pending"
        | "assigned"
        | "in_progress"
        | "awaiting_parts"
        | "awaiting_approval"
        | "completed"
        | "cancelled"
        | "disputed"
      work_order_priority: "low" | "normal" | "high" | "urgent"
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
      asset_meter_type: ["odometer", "hours", "none"],
      asset_status: [
        "acquired",
        "commissioned",
        "active",
        "under_maintenance",
        "retired",
        "disposed",
      ],
      billing_provider: ["none", "usc_pay", "stripe", "manual_invoice"],
      billing_status: ["trial", "active", "past_due", "cancelled"],
      compliance_doc_type: [
        "cof",
        "roadworthy_certificate",
        "business_licence",
        "insurance",
        "tax_clearance",
        "bbbee",
        "other",
      ],
      compliance_status: ["valid", "expiring_soon", "expired"],
      industry_mode: [
        "general",
        "mining",
        "fleet",
        "municipal",
        "government",
        "logistics",
      ],
      job_priority: ["normal", "urgent"],
      job_status: [
        "draft",
        "in_progress",
        "waiting_for_parts",
        "completed",
        "submitted",
        "paid",
      ],
      job_type: [
        "service",
        "mechanical_repair",
        "panel_beating",
        "towing",
        "accident_repair",
        "specialist",
        "compliance",
        "other",
      ],
      notification_type: [
        "compliance_expiry",
        "job_status_change",
        "payment",
        "system",
        "insurance_alert",
        "merchant_suspended",
        "merchant_reactivated",
        "work_order_assigned",
        "work_order_status_changed",
        "purchase_order_approval_needed",
        "purchase_order_approved",
        "document_expiring",
        "document_expired",
        "incident_reported",
        "incident_escalated",
        "maintenance_due",
        "low_stock",
        "generic",
      ],
      organisation_role: [
        "owner",
        "admin",
        "manager",
        "member",
        "viewer",
        "supervisor",
        "technician",
        "inspector",
        "procurement_officer",
        "finance",
        "fleet_manager",
        "operations_manager",
        "contractor",
      ],
      photo_stage: ["before", "during", "after"],
      service_provider_status: [
        "pending_onboarding",
        "active",
        "suspended",
        "terminated",
      ],
      service_provider_type: [
        "workshop",
        "contractor",
        "maintenance_provider",
        "supplier",
        "technician_org",
        "other",
      ],
      user_role: ["owner", "technician", "admin"],
      work_order_category: [
        "breakdown",
        "maintenance",
        "inspection",
        "repair",
        "service",
        "incident",
        "other",
      ],
      work_order_generic_status: [
        "draft",
        "pending",
        "assigned",
        "in_progress",
        "awaiting_parts",
        "awaiting_approval",
        "completed",
        "cancelled",
        "disputed",
      ],
      work_order_priority: ["low", "normal", "high", "urgent"],
    },
  },
} as const
