export type EnergyType = 'deep_focus' | 'quick_win' | 'people' | 'personal';

export type Todo = {
  id: string;
  title: string;
  content?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'doing' | 'done';
  is_completed: boolean;
  is_pinned: boolean;
  created_at: string;
  completed_at?: string | null;
  energy_type?: EnergyType | null;
  time_block_date?: string | null;
  time_block_start?: string | null;
  time_block_end?: string | null;
  time_block_order?: number | null;
};
