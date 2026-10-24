import { Task, CreateTaskDTO, UpdateTaskDTO, TaskComment, TaskTag, TaskTagXTask, TaskPriority, CreatePriorityDTO, UpdatePriorityDTO } from './types';

const API_BASE = '/api';

function normalizeDate(date?: string | null): string | undefined {
  if (!date) return undefined;
  const tIndex = date.indexOf('T');
  if (tIndex !== -1) return date.slice(0, tIndex);
  return date;
}

function logRequest(method: string, path: string) {
  console.log(`[API →] ${method} ${path}`);
}

function logResponse(path: string, data: any, error?: string) {
  if (error) {
    console.error(`[API ←] ${path} ERROR: ${error}`);
  } else {
    console.log(`[API ←] ${path} data:`, data);
  }
}

export async function fetchTasksRange(dateFrom: string, dateTo: string): Promise<Task[]> {
  const path = `${API_BASE}/tasks?date_from=${dateFrom}&date_to=${dateTo}`;
  logRequest('GET', path);
  const res = await fetch(path);
  if (!res.ok) {
    const errText = await res.text();
    logResponse(path, null, `${res.status}: ${errText}`);
    throw new Error('Failed to fetch tasks range');
  }
  const text = await res.text();
  const sanitized = text.replace(/:\s*NaN\b/gi, ': null');
  const tasks: Task[] = JSON.parse(sanitized);
  console.log(`[API ←] ${path} received ${tasks.length} tasks`);
  return tasks.map(task => ({
    ...task,
    description: task.description === undefined ? null : task.description,
    link_to_taskmanager: task.link_to_taskmanager === undefined ? null : task.link_to_taskmanager,
    due_date: task.due_date ? task.due_date.slice(0, 10) : null,
    closed_dttm: task.closed_dttm ? task.closed_dttm.slice(0, 19) : null,
  }));
}

export async function createTask(task: CreateTaskDTO): Promise<void> {
  const path = `${API_BASE}/tasks`;
  const payload = {
    ...task,
    due_date: normalizeDate(task.due_date),
  };
  logRequest('POST', path);
  logRequest('POST body', JSON.stringify(payload));
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    logResponse(path, null, `${res.status}: ${text}`);
    throw new Error('Failed to create task');
  }
  logResponse(path, JSON.parse(text));
}

export async function updateTask(taskId: number, task: UpdateTaskDTO): Promise<void> {
  const path = `${API_BASE}/tasks/${taskId}`;
  const { task_id, ...body } = task;
  const payload = {
    ...body,
    due_date: normalizeDate(body.due_date),
  };
  logRequest('PUT', path);
  logRequest('PUT body', JSON.stringify(payload));
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    logResponse(path, null, `${res.status}: ${text}`);
    throw new Error('Failed to update task');
  }
  logResponse(path, JSON.parse(text));
}

export async function deleteTask(taskId: number): Promise<void> {
  const path = `${API_BASE}/tasks/${taskId}`;
  logRequest('DELETE', path);
  const res = await fetch(path, { method: 'DELETE' });
  const text = await res.text();
  if (!res.ok) {
    logResponse(path, null, `${res.status}: ${text}`);
    throw new Error('Failed to delete task');
  }
  logResponse(path, JSON.parse(text));
}

// Новые эндпоинты синхронизации
export async function syncDownload(): Promise<void> {
  const path = `${API_BASE}/remote_db/sync_download`;
  logRequest('POST', path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('Sync download failed');
  logResponse(path, await res.json());
}

export async function syncUpload(): Promise<void> {
  const path = `${API_BASE}/remote_db/sync_upload`;
  logRequest('POST', path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('Sync upload failed');
  logResponse(path, await res.json());
}

export async function checkRemoteUpdates(): Promise<boolean> {
  const path = `${API_BASE}/remote_db/check_updates`;
  logRequest('GET', path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to check updates');
  const data = await res.json();
  console.log(`[API ←] ${path} updates: ${data.updates}`);
  return data.updates === true;
}

// ========== Комментарии ==========
export async function fetchTaskComments(taskId: number): Promise<TaskComment[]> {
  const path = `${API_BASE}/tasks/${taskId}/comments`;
  logRequest('GET', path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to fetch comments');
  const comments = await res.json();
  console.log(`[API ←] ${path} received ${comments.length} comments`);
  return comments;
}

export async function addTaskComment(taskId: number, text: string): Promise<void> {
  const path = `${API_BASE}/tasks/comment`;
  const payload = { task_id: taskId, text };
  logRequest('POST', path);
  logRequest('POST body', JSON.stringify(payload));
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to add comment');
  logResponse(path, await res.json());
}

export async function deleteTaskComment(commentId: number): Promise<void> {
  const path = `${API_BASE}/tasks/comment/delete/${commentId}`;
  logRequest('DELETE', path);
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete comment');
  logResponse(path, await res.json());
}

// ========== Теги ==========
export async function fetchAllTags(): Promise<TaskTag[]> {
  const path = `${API_BASE}/task_tags`;
  logRequest('GET', path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to fetch tags');
  const tags = await res.json();
  console.log(`[API ←] ${path} received ${tags.length} tags`);
  return tags;
}

export async function fetchTaskTagsXTask(): Promise<TaskTagXTask[]> {
  const path = `${API_BASE}/task_tags/tasks`;
  logRequest('GET', path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to fetch tag assignments');
  const assignments = await res.json();
  console.log(`[API ←] ${path} received ${assignments.length} assignments`);
  return assignments;
}

export async function createTag(tagText: string, tagColor: string): Promise<void> {
  const path = `${API_BASE}/task_tags`;
  const payload = { tag_text: tagText, tag_color: tagColor };
  logRequest('POST', path);
  logRequest('POST body', JSON.stringify(payload));
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create tag');
  logResponse(path, await res.json());
}

export async function assignTagToTask(taskTagId: number, taskId: number): Promise<void> {
  const path = `${API_BASE}/task_tags/assign`;
  const payload = { task_tag_id: taskTagId, task_id: taskId };
  logRequest('POST', path);
  logRequest('POST body', JSON.stringify(payload));
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to assign tag');
  logResponse(path, await res.json());
}

export async function unassignTagFromTask(taskTagId: number, taskId: number): Promise<void> {
  const path = `${API_BASE}/task_tags/unassign/${taskTagId}/task/${taskId}`;
  logRequest('DELETE', path);
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to unassign tag');
  logResponse(path, await res.json());
}

// ВНИМАНИЕ: следующий эндпоинт должен быть добавлен в бэкенд (app/api.py)
export async function deleteTagGlobally(taskTagId: number): Promise<void> {
  const path = `${API_BASE}/task_tags/${taskTagId}`;
  logRequest('DELETE', path);
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete tag');
  logResponse(path, await res.json());
}

export async function updateTag(tagId: number, tagText: string, tagColor: string): Promise<void> {
  const path = `${API_BASE}/task_tags/${tagId}`;
  const payload = { tag_text: tagText, tag_color: tagColor };
  logRequest('PUT', path);
  logRequest('PUT body', JSON.stringify(payload));
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update tag');
  logResponse(path, await res.json());
}

// ========== Приоритеты ==========
export async function fetchAllPriorities(): Promise<TaskPriority[]> {
  const path = `${API_BASE}/priority`;
  logRequest('GET', path);
  const res = await fetch(path);
  if (!res.ok) throw new Error('Failed to fetch priorities');
  const priorities = await res.json();
  console.log(`[API ←] ${path} received ${priorities.length} priorities`);
  return priorities;
}

export async function createPriority(dto: CreatePriorityDTO): Promise<void> {
  const path = `${API_BASE}/priority`;
  logRequest('POST', path);
  logRequest('POST body', JSON.stringify(dto));
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error('Failed to create priority');
  logResponse(path, await res.json());
}

export async function updatePriority(dto: UpdatePriorityDTO): Promise<void> {
  const path = `${API_BASE}/priority/${dto.priority_id}`;
  logRequest('PUT', path);
  logRequest('PUT body', JSON.stringify(dto));
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error('Failed to update priority');
  logResponse(path, await res.json());
}

export async function deletePriority(priorityId: number): Promise<void> {
  const path = `${API_BASE}/priority/${priorityId}`;
  logRequest('DELETE', path);
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete priority');
  logResponse(path, await res.json());
}

