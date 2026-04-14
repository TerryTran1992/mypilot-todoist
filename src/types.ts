export type EnergyType = 'deep_focus' | 'quick_win' | 'people' | 'personal';
export type Category = 'work' | 'personal' | 'family' | 'health' | 'learning';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Todo = {
  id: string;
  title: string;
  content?: string | null;
  priority: Priority;
  status: 'todo' | 'doing' | 'done';
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
};
