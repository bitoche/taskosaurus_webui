import {
  Task,
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskComment,
  TaskTag,
  TaskTagXTask,
  TaskPriority,
  CreatePriorityDTO,
  UpdatePriorityDTO,
  SqlQueryResult,
  User,
  UserAdmin,
  InviteToken,
  ImportSummary,
} from './types';

const API_BASE = '/api';

function normalizeDate(date?: string | null): string | null | undefined {
  if (date === undefined) return undefined;
  if (!date || date.trim() === '') return null;
  const tIndex = date.indexOf('T');
  return tIndex !== -1 ? date.slice(0, tIndex) : date;
}

function normalizeDateTime(dateTime?: string | null): string | null | undefined {
  if (dateTime === undefined) return undefined;
  if (!dateTime || dateTime.trim() === '') return null;
  return dateTime;
}

function logRequest(method: string, path: string) {
  console.log(`[API →] ${method} ${path}`);
}

function logResponse(path: string, data: any, error?: string, status?: number) {
  if (error) {
    if (path === `${API_BASE}/auth/me` && status === 401) {
      // Ожидаемый ответ при проверке сессии неавторизованного пользователя
      return;
    }
    console.error(`[API ←] ${path} ERROR: ${error}`);
  } else {
    console.log(`[API ←] ${path} data:`, data);
  }
}

async function request<T = void>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET';
  logRequest(method, path);

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status} ${res.statusText}`;
    try {
      const text = await res.text();
      if (text) {
        try {
          const errData = JSON.parse(text);
          if (typeof errData?.detail === 'string') {
            errorMessage = errData.detail;
          } else if (Array.isArray(errData?.detail)) {
            errorMessage = errData.detail
              .map((d: any) => (d.msg ? `${d.loc ? d.loc.slice(1).join('.') + ': ' : ''}${d.msg}` : JSON.stringify(d)))
              .join('; ');
          } else if (typeof errData?.message === 'string') {
            errorMessage = errData.message;
          } else {
            errorMessage = text;
          }
        } catch {
          errorMessage = text;
        }
      }
    } catch {
      // fallback to default errorMessage
    }

    logResponse(path, null, `${res.status}: ${errorMessage}`, res.status);
    const err: any = new Error(errorMessage);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) {
    logResponse(path, null);
    return undefined as unknown as T;
  }

  const text = await res.text();
  if (!text || !text.trim()) {
    logResponse(path, null);
    return undefined as unknown as T;
  }

  const data = JSON.parse(text);
  logResponse(path, data);
  return data as T;
}

export async function fetchTasksRange(dateFrom: string, dateTo: string): Promise<Task[]> {
  const path = `${API_BASE}/tasks?date_from=${dateFrom}&date_to=${dateTo}`;
  const tasks = await request<Task[]>(path);
  console.log(`[API ←] ${path} received ${tasks.length} tasks`);
  return tasks.map(task => ({
    ...task,
    description: task.description ?? null,
    link_to_taskmanager: task.link_to_taskmanager ?? null,
    due_date: task.due_date ? task.due_date.slice(0, 10) : null,
    closed_dttm: task.closed_dttm ? task.closed_dttm.slice(0, 19) : null,
    created_at: task.created_at ? task.created_at.slice(0, 19) : null,
  }));
}

export async function fetchNoDateTasks(): Promise<Task[]> {
  const path = `${API_BASE}/tasks?no_date=true`;
  const tasks = await request<Task[]>(path);
  console.log(`[API ←] ${path} received ${tasks.length} tasks`);
  return tasks.map(task => ({
    ...task,
    description: task.description ?? null,
    link_to_taskmanager: task.link_to_taskmanager ?? null,
    due_date: task.due_date ? task.due_date.slice(0, 10) : null,
    closed_dttm: task.closed_dttm ? task.closed_dttm.slice(0, 19) : null,
    created_at: task.created_at ? task.created_at.slice(0, 19) : null,
  }));
}

export async function createTask(task: CreateTaskDTO): Promise<Task> {
  const path = `${API_BASE}/tasks`;
  const payload = {
    ...task,
    description: task.description?.trim() || null,
    link_to_taskmanager: task.link_to_taskmanager?.trim() || null,
    due_date: normalizeDate(task.due_date) ?? null,
  };
  return request<Task>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateTask(taskId: number, task: UpdateTaskDTO): Promise<Task> {
  const path = `${API_BASE}/tasks/${taskId}`;
  const { task_id, ...body } = task;
  const payload: Record<string, any> = { ...body };
  if (body.due_date !== undefined) {
    payload.due_date = normalizeDate(body.due_date);
  }
  if (body.closed_dttm !== undefined) {
    payload.closed_dttm = normalizeDateTime(body.closed_dttm);
  }
  if (body.description !== undefined) {
    payload.description = body.description?.trim() || null;
  }
  if (body.link_to_taskmanager !== undefined) {
    payload.link_to_taskmanager = body.link_to_taskmanager?.trim() || null;
  }
  return request<Task>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(taskId: number): Promise<void> {
  await request<void>(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
}

export async function fetchTaskComments(taskId: number): Promise<TaskComment[]> {
  const path = `${API_BASE}/tasks/${taskId}/comments`;
  const comments = await request<TaskComment[]>(path);
  console.log(`[API ←] ${path} received ${comments.length} comments`);
  return comments;
}

export async function addTaskComment(taskId: number, text: string): Promise<TaskComment> {
  const path = `${API_BASE}/tasks/comment`;
  return request<TaskComment>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, text }),
  });
}

export async function deleteTaskComment(commentId: number): Promise<void> {
  await request<void>(`${API_BASE}/tasks/comment/delete/${commentId}`, { method: 'DELETE' });
}

export async function fetchAllTags(): Promise<TaskTag[]> {
  const path = `${API_BASE}/task_tags`;
  const tags = await request<TaskTag[]>(path);
  console.log(`[API ←] ${path} received ${tags.length} tags`);
  return tags;
}

export async function fetchTaskTagsXTask(): Promise<TaskTagXTask[]> {
  const path = `${API_BASE}/task_tags/tasks`;
  const assignments = await request<TaskTagXTask[]>(path);
  console.log(`[API ←] ${path} received ${assignments.length} assignments`);
  return assignments;
}

export async function createTag(tagText: string, tagColor: string): Promise<TaskTag> {
  const path = `${API_BASE}/task_tags`;
  return request<TaskTag>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_text: tagText, tag_color: tagColor }),
  });
}

export async function assignTagToTask(taskTagId: number, taskId: number): Promise<TaskTagXTask> {
  const path = `${API_BASE}/task_tags/assign`;
  return request<TaskTagXTask>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_tag_id: taskTagId, task_id: taskId }),
  });
}

export async function unassignTagFromTask(taskTagId: number, taskId: number): Promise<void> {
  await request<void>(`${API_BASE}/task_tags/unassign/${taskTagId}/task/${taskId}`, { method: 'DELETE' });
}

export async function deleteTagGlobally(taskTagId: number): Promise<void> {
  await request<void>(`${API_BASE}/task_tags/${taskTagId}`, { method: 'DELETE' });
}

export async function updateTag(tagId: number, tagText: string, tagColor: string): Promise<TaskTag> {
  const path = `${API_BASE}/task_tags/${tagId}`;
  return request<TaskTag>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_text: tagText, tag_color: tagColor }),
  });
}

export async function fetchAllPriorities(): Promise<TaskPriority[]> {
  const path = `${API_BASE}/priority`;
  const priorities = await request<TaskPriority[]>(path);
  console.log(`[API ←] ${path} received ${priorities.length} priorities`);
  return priorities;
}

export async function createPriority(dto: CreatePriorityDTO): Promise<TaskPriority> {
  const path = `${API_BASE}/priority`;
  return request<TaskPriority>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function updatePriority(dto: UpdatePriorityDTO): Promise<TaskPriority> {
  const path = `${API_BASE}/priority/${dto.priority_id}`;
  return request<TaskPriority>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function deletePriority(priorityId: number): Promise<void> {
  await request<void>(`${API_BASE}/priority/${priorityId}`, { method: 'DELETE' });
}

export async function fetchTaskById(taskId: number): Promise<Task> {
  const path = `${API_BASE}/tasks/${taskId}`;
  const task = await request<Task>(path);
  return {
    ...task,
    description: task.description ?? null,
    link_to_taskmanager: task.link_to_taskmanager ?? null,
    due_date: task.due_date ? task.due_date.slice(0, 10) : null,
    closed_dttm: task.closed_dttm ? task.closed_dttm.slice(0, 19) : null,
    created_at: task.created_at ? task.created_at.slice(0, 19) : null,
  };
}

export async function executeTaskQuery(sql: string): Promise<SqlQueryResult> {
  const path = `${API_BASE}/tasks/query`;
  return request<SqlQueryResult>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
}

// ── Аутентификация и инвайты ─────────────────────────────────────────────────

export async function loginUser(username: string, password: string): Promise<User> {
  return request<User>(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function logoutUser(): Promise<void> {
  await request<void>(`${API_BASE}/auth/logout`, {
    method: 'POST',
  });
}

export async function fetchCurrentUser(): Promise<User> {
  return request<User>(`${API_BASE}/auth/me`);
}

export async function createInviteToken(expiresHours?: number): Promise<InviteToken> {
  return request<InviteToken>(`${API_BASE}/auth/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expires_hours: expiresHours }),
  });
}

export async function fetchActiveInvites(): Promise<InviteToken[]> {
  return request<InviteToken[]>(`${API_BASE}/auth/invites`);
}

export async function deleteInviteToken(token: string): Promise<void> {
  await request<void>(`${API_BASE}/auth/invites/${encodeURIComponent(token)}`, {
    method: 'DELETE',
  });
}

export async function registerWithInvite(token: string, username: string, password: string): Promise<User> {
  return request<User>(`${API_BASE}/auth/register-with-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, username, password }),
  });
}

// ── Управление пользователями (только для админа) ────────────────────────────

export async function fetchUsersList(): Promise<UserAdmin[]> {
  return request<UserAdmin[]>(`${API_BASE}/users`);
}

export async function deleteUser(userId: number): Promise<void> {
  await request<void>(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function revokeUserSessions(userId: number): Promise<{ message: string; token_version: number }> {
  return request<{ message: string; token_version: number }>(`${API_BASE}/users/${userId}/revoke-sessions`, {
    method: 'POST',
  });
}

// ── Экспорт и Импорт данных ──────────────────────────────────────────────────

export async function exportMyData(): Promise<any> {
  return request<any>(`${API_BASE}/users/me/export`);
}

export async function importMyData(data: any): Promise<ImportSummary> {
  return request<ImportSummary>(`${API_BASE}/users/me/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function exportUserDataByAdmin(userId: number): Promise<any> {
  return request<any>(`${API_BASE}/users/${userId}/export`);
}

export async function importUserDataByAdmin(userId: number, data: any): Promise<ImportSummary> {
  return request<ImportSummary>(`${API_BASE}/users/${userId}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchBackendVersion(): Promise<string | null> {
  try {
    const res = await request<{ version?: string }>(`${API_BASE}/version`);
    return res?.version || null;
  } catch {
    return null;
  }
}




