export type EnergyType = 'deep_focus' | 'quick_win';

export type TodoComment = {
  id: string;
  todo_id: string;
  user_id: string;
  user_name?: string;
  content: string;
  created_at: string;
  updated_at: string;
};
export type Category = 'work' | 'personal' | 'family' | 'health' | 'learning';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Todo = {
  id: string;
  title: string;
  content?: string | null;
  priority: Priority;
  priority_score?: number;
  is_completed: boolean;
  is_pinned: boolean;
  created_at: string;
  completed_at?: string | null;
  energy_type?: EnergyType | null;
  category?: Category | null;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  deadline?: string | null;
  time_block_date?: string | null;
  time_block_start?: string | null;
  time_block_end?: string | null;
  time_block_order?: number | null;
  delegatable?: boolean;
  delegated_to?: string | null;
  delegation_status?: DelegationStatus | null;
  delegated_at?: string | null;
  follow_up_days?: number | null;
};

export type DelegationStatus = 'delegated' | 'in_progress' | 'done';
