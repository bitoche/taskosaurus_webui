export interface Task {
  task_id: number;
  title: string;
  description?: string | null;
  link_to_taskmanager?: string | null;
  due_date?: string | null;        // YYYY-MM-DD
  closed_dttm?: string | null;     // ISO datetime закрытия
  created_at?: string | null;      // ISO datetime создания
  task_status?: number | null;
  task_priority_id?: number | null;
}

export interface CreateTaskDTO {
  title: string;
  description?: string | null;
  link_to_taskmanager?: string | null;
  due_date?: string | null;
  task_status?: number | null;
  task_priority_id?: number | null;
}

export interface UpdateTaskDTO {
  task_id: number;
  title?: string | null;
  description?: string | null;
  link_to_taskmanager?: string | null;
  due_date?: string | null;
  closed_dttm?: string | null;
  task_status?: number | null;
  task_priority_id?: number | null;
}

// Комментарии
export interface TaskComment {
  comment_id: number;
  task_id: number;
  text: string;
  created_at: string; // ISO datetime
}

export interface CreateTaskCommentDTO {
  task_id: number;
  text: string;
}

// Теги
export interface TaskTag {
  task_tag_id: number;
  tag_color: string;   // цвет в HEX или название
  tag_text: string;
}

export interface TaskTagXTask {
  task_tag_id: number;
  task_id: number;
}

export interface CreateTaskTagDTO {
  tag_color: string;
  tag_text: string;
}

export interface CreateTaskTagXTaskDTO {
  task_tag_id: number;
  task_id: number;
}

// Приоритеты
export interface TaskPriority {
  priority_id: number;
  priority_color: string;   // цвет в HEX
  priority_name: string;
  priority_sorting_weight: number;
}

export interface CreatePriorityDTO {
  priority_color: string;
  priority_name: string;
  priority_sorting_weight: number;
}

export interface UpdatePriorityDTO {
  priority_id: number;
  priority_color?: string;
  priority_name?: string;
  priority_sorting_weight?: number;
}

// SQL Query Result
export interface SqlQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  count: number;
}

