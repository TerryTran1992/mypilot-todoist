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
};
