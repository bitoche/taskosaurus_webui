import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTasksRange, createTask, updateTask, deleteTask,
  syncDownload, syncUpload,
  fetchAllTags, fetchTaskTagsXTask,
  assignTagToTask, unassignTagFromTask, createTag,
  deleteTagGlobally, updateTag, checkRemoteUpdates,
  fetchAllPriorities, createPriority, updatePriority, deletePriority,
} from './api';
import { Task, CreateTaskDTO, UpdateTaskDTO, TaskTag, TaskPriority } from './types';
import CalendarStrip, { CalendarStripRef } from './components/CalendarStrip';
import TaskModal from './components/TaskModal';
import TaskList from './components/TaskList';
import { ChevronLeft, ChevronRight, Home, Upload, Download, RefreshCw, AlertTriangle, Moon, Sun } from 'lucide-react';
import TagManager from './components/TagManager';
import PriorityManager from './components/PriorityManager';

const App: React.FC = () => {
  const calendarRef = useRef<CalendarStripRef>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const syncCounter = useRef(0);
  const [modalState, setModalState] = useState<{ isOpen: boolean; task?: Task | null; defaultDate?: string }>({
    isOpen: false,
  });
  const [remoteUpdatesAvailable, setRemoteUpdatesAvailable] = useState(false);

  // === Темная тема ===
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // === Состояния для тегов ===
  const [allTags, setAllTags] = useState<TaskTag[]>([]);
  const [taskTagsMap, setTaskTagsMap] = useState<Map<number, TaskTag[]>>(new Map());
  const [filterTagId, setFilterTagId] = useState<number | null>(null);

  // === Состояния для приоритетов ===
  const [allPriorities, setAllPriorities] = useState<TaskPriority[]>([]);
  const [filterPriorityId, setFilterPriorityId] = useState<number | null>(null);

  // === Состояние для toast-ов ===
  type Toast = {
    id: string;
    uniqueId: string;
    type: 'info' | 'warning' | 'error' | 'holidays';
    message: React.ReactNode;
    action?: { label: string; handler: () => void };
  };
  const [toastQueue, setToastQueue] = useState<Toast[]>([]);
  const toastIdCounter = useRef(0);
  const activeToasts = useRef<Set<string>>(new Set());

  const addToast = useCallback((id: string, toast: Omit<Toast, 'id' | 'uniqueId'>) => {
    if (activeToasts.current.has(id)) return;
    activeToasts.current.add(id);
    const uniqueId = `${Date.now()}-${toastIdCounter.current++}`;
    setToastQueue(prev => [...prev, { ...toast, id, uniqueId }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    activeToasts.current.delete(id);
    setToastQueue(prev => prev.filter(t => t.id !== id));
  }, []);

  // === Вспомогательная функция синхронизации с индикатором ===
  const performSync = useCallback(async (syncFn: () => Promise<void>) => {
    syncCounter.current++;
    if (syncCounter.current === 1) {
      setSyncing(true);
      addToast('syncing', { type: 'info', message: <><RefreshCw size={16} className="spin-icon" /><div className='toast-text'>Синхронизация с облаком...</div></> });
    }
    try {
      await syncFn();
    } catch (err: any) {
      console.error('Sync error:', err);
      addToast('error-sync', { type: 'error', message: `Ошибка синхронизации: ${err?.message || err}` });
    } finally {
      syncCounter.current--;
      if (syncCounter.current === 0) {
        setSyncing(false);
        removeToast('syncing');
      }
    }
  }, [addToast, removeToast]);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // === Загрузка задач и тегов ===
  const loadTasksForRange = useCallback(async (from: string, to: string) => {
    try {
      const newTasks = await fetchTasksRange(from, to);
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.task_id));
        const uniqueNew = newTasks.filter(t => !existingIds.has(t.task_id));
        return [...prev, ...uniqueNew];
      });
      return newTasks;
    } catch (err: any) {
      console.error('Failed to load range', err);
      addToast('error-load-tasks', { type: 'error', message: `Ошибка загрузки задач: ${err?.message || err}` });
      return [];
    }
  }, [addToast]);

  // === Полное обновление задач за период ===
  const refreshTasksForRange = useCallback(async (from: string, to: string) => {
    try {
      const newTasks = await fetchTasksRange(from, to);
      setTasks(newTasks);
      return newTasks;
    } catch (err: any) {
      console.error('Failed to refresh tasks range', err);
      addToast('error-refresh-tasks', { type: 'error', message: `Ошибка обновления задач: ${err?.message || err}` });
      return [];
    }
  }, [addToast]);

  const loadTagsData = useCallback(async () => {
    try {
      const tags = await fetchAllTags();
      const assignments = await fetchTaskTagsXTask();
      const map = new Map<number, TaskTag[]>();
      for (const a of assignments) {
        const tag = tags.find(t => t.task_tag_id === a.task_tag_id);
        if (tag) {
          if (!map.has(a.task_id)) map.set(a.task_id, []);
          map.get(a.task_id)!.push(tag);
        }
      }
      setAllTags(tags);
      setTaskTagsMap(map);
    } catch (err: any) {
      console.error('Failed to load tags data', err);
      addToast('error-load-tags', { type: 'error', message: `Ошибка загрузки тегов: ${err?.message || err}` });
    }
  }, [addToast]);

  const loadPrioritiesData = useCallback(async () => {
    try {
      const priorities = await fetchAllPriorities();
      setAllPriorities(priorities);
    } catch (err: any) {
      console.error('Failed to load priorities data', err);
      addToast('error-load-priorities', { type: 'error', message: `Ошибка загрузки приоритетов: ${err?.message || err}` });
    }
  }, [addToast]);

  // === Обработчики для кнопок синхронизации ===
  const handleSaveToCloud = async () => {
    setSaving(true);
    try {
      await performSync(syncUpload);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error('Failed to save to cloud', err);
      addToast('error-save', { type: 'error', message: `Ошибка сохранения в облако: ${err?.message || err}` });
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };

  const handleLoadFromCloud = async () => {
    setLoadingCloud(true);
    try {
      await performSync(syncDownload);
      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - 30);
      const to = new Date(today);
      to.setDate(today.getDate() + 30);
      const fromStr = formatLocalDate(from);
      const toStr = formatLocalDate(to);
      await Promise.all([
        refreshTasksForRange(fromStr, toStr),
        loadTagsData(),
        loadPrioritiesData(),
      ]);
      setHasUnsavedChanges(false);
      setRemoteUpdatesAvailable(false);
    } catch (err: any) {
      console.error('Failed to load from cloud', err);
      addToast('error-load', { type: 'error', message: `Ошибка загрузки из облака: ${err?.message || err}` });
    } finally {
      setTimeout(() => setLoadingCloud(false), 500);
    }
  };

  const handleRefreshTasks = async () => {
    setRefreshing(true);
    try {
      await performSync(async () => {
        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - 30);
        const to = new Date(today);
        to.setDate(today.getDate() + 30);
        const fromStr = formatLocalDate(from);
        const toStr = formatLocalDate(to);
        await Promise.all([
          refreshTasksForRange(fromStr, toStr),
          loadTagsData(),
          loadPrioritiesData(),
        ]);
      });
    } catch (err: any) {
      console.error('Failed to refresh tasks', err);
      addToast('error-refresh', { type: 'error', message: `Ошибка обновления: ${err?.message || err}` });
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // === Инициализация: загружаем данные только один раз при старте ===
  useEffect(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    const to = new Date(today);
    to.setDate(today.getDate() + 30);
    const fromStr = formatLocalDate(from);
    const toStr = formatLocalDate(to);

    Promise.all([
      loadTasksForRange(fromStr, toStr),
      loadTagsData(),
      loadPrioritiesData(),
    ]).finally(() => setLoading(false));
  }, [loadTasksForRange, loadTagsData, loadPrioritiesData]);

  // === Предупреждение при закрытии страницы при наличии изменений ===
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // === Фоновая проверка обновлений (без навязчивых индикаторов каждые 10 сек) ===
  const checkRemoteUpdatesHandler = useCallback(async () => {
    if (remoteUpdatesAvailable) return;
    try {
      const hasUpdates = await checkRemoteUpdates();
      if (hasUpdates) {
        setRemoteUpdatesAvailable(true);
      }
    } catch (err) {
      console.error('Failed to check remote updates', err);
    }
  }, [remoteUpdatesAvailable]);
  
  useEffect(() => {
    checkRemoteUpdatesHandler();
    const interval = setInterval(checkRemoteUpdatesHandler, 10000);
    return () => clearInterval(interval);
  }, [checkRemoteUpdatesHandler]);

  // Toast для доступных обновлений в облаке
  useEffect(() => {
    if (remoteUpdatesAvailable && !syncing) {
      addToast('remote-update', { 
        type: 'warning', 
        message: <><AlertTriangle size={16} /><div className='toast-text'>Доступна новая версия в облаке</div></>, 
        action: { label: 'Загрузить', handler: handleLoadFromCloud } 
      });
    }
  }, [remoteUpdatesAvailable, syncing, addToast, handleLoadFromCloud]);

  useEffect(() => {
    if (!remoteUpdatesAvailable || syncing) {
      removeToast('remote-update');
    }
  }, [remoteUpdatesAvailable, syncing, removeToast]);

  // Toast для несохранённых изменений
  useEffect(() => {
    if (hasUnsavedChanges && !syncing) {
      addToast('unsaved', { 
        type: 'error', 
        message: <><AlertTriangle size={16} /><div className='toast-text'>Есть несохранённые изменения</div></>, 
        action: { label: 'Сохранить', handler: handleSaveToCloud } 
      });
    }
  }, [hasUnsavedChanges, syncing, addToast, handleSaveToCloud]);

  useEffect(() => {
    if (!hasUnsavedChanges || syncing) {
      removeToast('unsaved');
    }
  }, [hasUnsavedChanges, syncing, removeToast]);

  const scrollToToday = () => {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    calendarRef.current?.scrollToDate(todayStr);
  };

  const handleAddTask = (date: string) => {
    setModalState({ isOpen: true, task: null, defaultDate: date });
  };

  const handleEditTask = (task: Task) => {
    setModalState({ isOpen: true, task });
  };

  const handleTaskClickFromList = (task: Task) => {
    let targetDate: string | undefined;
    
    if (task.task_status === 2 && task.closed_dttm) {
      targetDate = task.closed_dttm.slice(0, 10);
    } else if (task.due_date) {
      targetDate = task.due_date;
    }
    
    if (targetDate) {
      calendarRef.current?.scrollToDate(targetDate, task.task_id);
    }
  };

  const handleSaveTask = async (taskData: Omit<Task, 'task_id'>) => {
    try {
      if (modalState.task) {
        const updateDto: UpdateTaskDTO = {
          task_id: modalState.task.task_id,
          title: taskData.title ?? undefined,
          description: taskData.description ?? undefined,
          link_to_taskmanager: taskData.link_to_taskmanager ?? undefined,
          due_date: taskData.due_date ?? undefined,
          closed_dttm: taskData.closed_dttm ?? undefined,
          task_status: taskData.task_status ?? undefined,
          task_priority_id: taskData.task_priority_id ?? undefined,
        };
        const updated = await updateTask(modalState.task.task_id, updateDto);
        setTasks(prev => prev.map(t => (t.task_id === modalState.task!.task_id ? { ...t, ...taskData, ...updated } : t)));
        setModalState({ isOpen: false });
        setHasUnsavedChanges(true);
      } else {
        const createDto: CreateTaskDTO = {
          title: taskData.title,
          description: taskData.description ?? null,
          link_to_taskmanager: taskData.link_to_taskmanager ?? null,
          due_date: taskData.due_date ?? undefined,
          task_status: taskData.task_status ?? null,
          task_priority_id: taskData.task_priority_id ?? null,
        };
        await createTask(createDto);
        const today = new Date();
        const from = new Date(today);
        from.setDate(today.getDate() - 30);
        const to = new Date(today);
        to.setDate(today.getDate() + 30);
        await loadTasksForRange(formatLocalDate(from), formatLocalDate(to));
        setModalState({ isOpen: false });
        setHasUnsavedChanges(true);
      }
    } catch (err: any) {
      console.error('Failed to save task', err);
      addToast('error-task-save', {
        type: 'error',
        message: `Ошибка сохранения задачи: ${err?.message || err}`,
      });
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (window.confirm('Удалить задачу?')) {
      try {
        await deleteTask(taskId);
        setTasks(prev => prev.filter(t => t.task_id !== taskId));
        if (modalState.task?.task_id === taskId) {
          setModalState({ isOpen: false });
        }
        setHasUnsavedChanges(true);
      } catch (err: any) {
        console.error('Failed to delete task', err);
        addToast('error-task-delete', {
          type: 'error',
          message: `Ошибка удаления задачи: ${err?.message || err}`,
        });
      }
    }
  };

  const handleMoveTask = async (taskId: number, newDueDate: string) => {
    const taskToUpdate = tasks.find(t => t.task_id === taskId);
    if (!taskToUpdate) return;
    const updateDto: UpdateTaskDTO = {
      task_id: taskId,
      title: taskToUpdate.title,
      description: taskToUpdate.description,
      link_to_taskmanager: taskToUpdate.link_to_taskmanager,
      due_date: newDueDate,
      task_status: taskToUpdate.task_status,
      task_priority_id: taskToUpdate.task_priority_id ?? null,
    };
    try {
      await updateTask(taskId, updateDto);
      setTasks(prev => prev.map(t => (t.task_id === taskId ? { ...t, due_date: newDueDate } : t)));
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to move task', err);
      addToast('error-task-move', {
        type: 'error',
        message: `Ошибка переноса задачи: ${err?.message || err}`,
      });
    }
  };

  const handleToggleStatus = async (taskId: number, newStatus: number) => {
    const taskToUpdate = tasks.find(t => t.task_id === taskId);
    if (!taskToUpdate) return;
    const updateDto: UpdateTaskDTO = {
      task_id: taskId,
      title: taskToUpdate.title,
      description: taskToUpdate.description,
      link_to_taskmanager: taskToUpdate.link_to_taskmanager,
      due_date: taskToUpdate.due_date,
      task_status: newStatus,
      task_priority_id: taskToUpdate.task_priority_id ?? null,
    };
    try {
      await updateTask(taskId, updateDto);
      setTasks(prev => prev.map(t => (t.task_id === taskId ? { ...t, task_status: newStatus } : t)));
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to toggle status', err);
      addToast('error-task-status', {
        type: 'error',
        message: `Ошибка изменения статуса: ${err?.message || err}`,
      });
    }
  };

  const closeModal = () => setModalState({ isOpen: false });

  const refreshTagsForTask = useCallback(async (taskId: number) => {
    try {
      const assignments = await fetchTaskTagsXTask();
      const tags = await fetchAllTags();
      const taskTags = assignments
        .filter(a => a.task_id === taskId)
        .map(a => tags.find(t => t.task_tag_id === a.task_tag_id))
        .filter((t): t is TaskTag => t !== undefined);
      setTaskTagsMap(prev => new Map(prev).set(taskId, taskTags));
    } catch (err: any) {
      console.error('Failed to refresh tags for task', err);
      addToast('error-refresh-tags', {
        type: 'error',
        message: `Ошибка обновления тегов задачи: ${err?.message || err}`,
      });
    }
  }, [addToast]);

  const handleAssignTag = useCallback(async (tagId: number) => {
    if (!modalState.task) return;
    try {
      await assignTagToTask(tagId, modalState.task.task_id);
      await refreshTagsForTask(modalState.task.task_id);
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to assign tag', err);
      addToast('error-tag-assign', {
        type: 'error',
        message: `Ошибка назначения тега: ${err?.message || err}`,
      });
    }
  }, [modalState.task, refreshTagsForTask, addToast]);

  const handleRemoveTagFromTask = useCallback(async (taskId: number, tagId: number) => {
    try {
      await unassignTagFromTask(tagId, taskId);
      await refreshTagsForTask(taskId);
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to remove tag from task', err);
      addToast('error-tag-remove', {
        type: 'error',
        message: `Ошибка отвязки тега: ${err?.message || err}`,
      });
    }
  }, [refreshTagsForTask, addToast]);

  const handleCreateTag = useCallback(async (tagText: string, tagColor: string) => {
    try {
      await createTag(tagText, tagColor);
      await loadTagsData();
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to create tag', err);
      addToast('error-tag-create', {
        type: 'error',
        message: `Ошибка создания тега: ${err?.message || err}`,
      });
    }
  }, [loadTagsData, addToast]);

  const handleUpdateTag = useCallback(async (tagId: number, text: string, color: string) => {
    try {
      await updateTag(tagId, text, color);
      await loadTagsData();
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to update tag', err);
      addToast('error-tag-update', {
        type: 'error',
        message: `Ошибка обновления тега: ${err?.message || err}`,
      });
    }
  }, [loadTagsData, addToast]);

  const handleDeleteTagGlobally = useCallback(async (tagId: number) => {
    try {
      await deleteTagGlobally(tagId);
      await loadTagsData();
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to delete tag globally', err);
      addToast('error-tag-delete', {
        type: 'error',
        message: `Ошибка удаления тега: ${err?.message || err}`,
      });
    }
  }, [loadTagsData, addToast]);

  const handleCreatePriority = useCallback(async (name: string, color: string, weight: number) => {
    try {
      await createPriority({ priority_name: name, priority_color: color, priority_sorting_weight: weight });
      await loadPrioritiesData();
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to create priority', err);
      addToast('error-priority-create', {
        type: 'error',
        message: `Ошибка создания приоритета: ${err?.message || err}`,
      });
    }
  }, [loadPrioritiesData, addToast]);

  const handleUpdatePriority = useCallback(async (priorityId: number, name: string, color: string, weight: number) => {
    try {
      await updatePriority({ priority_id: priorityId, priority_name: name, priority_color: color, priority_sorting_weight: weight });
      await loadPrioritiesData();
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to update priority', err);
      addToast('error-priority-update', {
        type: 'error',
        message: `Ошибка обновления приоритета: ${err?.message || err}`,
      });
    }
  }, [loadPrioritiesData, addToast]);

  const handleDeletePriority = useCallback(async (priorityId: number) => {
    try {
      await deletePriority(priorityId);
      await loadPrioritiesData();
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error('Failed to delete priority', err);
      addToast('error-priority-delete', {
        type: 'error',
        message: `Ошибка удаления приоритета: ${err?.message || err}`,
      });
    }
  }, [loadPrioritiesData, addToast]);

  if (loading) return <div className="calendar-main">Загрузка...</div>;

  const filteredTasks = filterTagId || filterPriorityId
    ? tasks.filter(task => {
        if (filterTagId && !(taskTagsMap.get(task.task_id) || []).some(tag => tag.task_tag_id === filterTagId)) return false;
        if (filterPriorityId && task.task_priority_id !== filterPriorityId) return false;
        return true;
      })
    : tasks;

  return (
    <>
      <div className="calendar-main">
        <div className="calendar-header">
          <div className="title-section">
            <h1>Календарь задач</h1>
          </div>
          <div className="nav-buttons">
            <button className="nav-btn theme-toggle-btn" onClick={toggleTheme} title={isDark ? 'Светлая тема' : 'Темная тема'}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="nav-btn" onClick={() => calendarRef.current?.scrollLeft()}>
              <ChevronLeft size={20} />
            </button>
            <button className="nav-btn" onClick={() => calendarRef.current?.scrollRight()}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <CalendarStrip
          ref={calendarRef}
          tasks={filteredTasks}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onMoveTask={handleMoveTask}
          onLoadRange={loadTasksForRange}
          onToggleStatus={handleToggleStatus}
          taskTagsMap={taskTagsMap}
          onRemoveTag={handleRemoveTagFromTask}
          allPriorities={allPriorities}
          onHolidaysLoadingChange={(loading) => {
            if (loading) {
              addToast('holidays-loading', { type: 'holidays', message: <><RefreshCw size={16} className="spin-icon" /><div className='toast-text'>Загружаем праздники...</div></> });
            } else {
              removeToast('holidays-loading');
            }
          }}
        />
        <TagManager
          allTags={allTags}
          onCreateTag={handleCreateTag}
          onFilterByTag={setFilterTagId}
          activeFilterTagId={filterTagId}
          onDeleteTagGlobally={handleDeleteTagGlobally}
          onUpdateTag={handleUpdateTag}
        />
        <PriorityManager
          allPriorities={allPriorities}
          onCreatePriority={handleCreatePriority}
          onFilterByPriority={setFilterPriorityId}
          activeFilterPriorityId={filterPriorityId}
          onDeletePriority={handleDeletePriority}
          onUpdatePriority={handleUpdatePriority}
        />
        <TaskList
          tasks={filteredTasks}
          taskTagsMap={taskTagsMap}
          onTaskClick={handleTaskClickFromList}
          onToggleStatus={handleToggleStatus}
          onEditTask={handleEditTask}
          onDeleteTask={(task) => handleDeleteTask(task.task_id)}
        />
        <footer>
          Клик по дню – новая задача, по названию – редактировать.
        </footer>
      </div>
      <TaskModal
        isOpen={modalState.isOpen}
        task={modalState.task || undefined}
        defaultDate={modalState.defaultDate}
        onSave={handleSaveTask}
        onDelete={() => { if (modalState.task) handleDeleteTask(modalState.task.task_id); }}
        onClose={closeModal}
        allTags={allTags}
        taskTags={modalState.task ? taskTagsMap.get(modalState.task.task_id) || [] : []}
        onAssignTag={handleAssignTag}
        onRemoveTag={(tagId) => { if (modalState.task) handleRemoveTagFromTask(modalState.task.task_id, tagId); }}
        onCreateTag={handleCreateTag}
        allPriorities={allPriorities}
      />
      <div className="fixed-buttons">
        <button className={`sync-btn ${saving ? 'sync-btn-loading' : ''}`} onClick={handleSaveToCloud} disabled={saving || loadingCloud || refreshing} title="Сохранить в облако">
          <Upload size={20} className={saving ? 'pulse-icon' : ''} />
        </button>
        <button className={`sync-btn ${loadingCloud ? 'sync-btn-loading' : ''}`} onClick={handleLoadFromCloud} disabled={saving || loadingCloud || refreshing} title="Загрузить из облака">
          <Download size={20} className={loadingCloud ? 'pulse-icon' : ''} />
        </button>
        <button className={`sync-btn ${refreshing ? 'sync-btn-loading' : ''}`} onClick={handleRefreshTasks} disabled={saving || loadingCloud || refreshing} title="Обновить список задач">
          <RefreshCw size={20} className={refreshing ? 'spin-icon' : ''} />
        </button>
        <button className="today-btn-fixed" onClick={scrollToToday} title="Перейти к сегодняшнему дню">
          <Home size={20} />
        </button>
      </div>

      <div className="toast-container">
        {toastQueue.map((toast, index) => (
          <div key={toast.uniqueId} className={`toast toast-${toast.type}`} style={{ animationDelay: `${index * 0.05}s` }}>
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <button onClick={toast.action.handler} className="toast-btn">
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export default App;
