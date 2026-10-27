import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTasksRange, createTask, updateTask, deleteTask,
  fetchAllTags, fetchTaskTagsXTask,
  assignTagToTask, unassignTagFromTask, createTag,
  deleteTagGlobally, updateTag,
  fetchAllPriorities, createPriority, updatePriority, deletePriority,
  fetchTaskById,
  fetchCurrentUser, logoutUser,
  fetchBackendVersion,
} from './api';
import packageJson from '../package.json';
import { Task, CreateTaskDTO, UpdateTaskDTO, TaskTag, TaskPriority, User } from './types';
import CalendarStrip, { CalendarStripRef } from './components/CalendarStrip';
import MobileCalendarView from './components/MobileCalendarView';
import TaskModal from './components/TaskModal';
import TaskList from './components/TaskList';
import SqlQueryModal from './components/SqlQueryModal';
import AuthScreen from './components/AuthScreen';
import AdminUsersModal from './components/AdminUsersModal';
import DataBackupModal from './components/DataBackupModal';
import { ChevronLeft, ChevronRight, Home, RefreshCw, Moon, Sun, Database, X, LogOut, User as UserIcon, Users, ArrowUpDown, Loader2, Smartphone, Monitor, ChevronDown, ChevronUp } from 'lucide-react';
import TagManager from './components/TagManager';
import PriorityManager from './components/PriorityManager';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  const calendarRef = useRef<CalendarStripRef>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean; task?: Task | null; defaultDate?: string }>({
    isOpen: false,
  });
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);

  // Режим отображения: мобильный вид или десктопный горизонтальный календарь
  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    const saved = localStorage.getItem('view_mode');
    if (saved === 'mobile') return true;
    if (saved === 'desktop') return false;
    return typeof window !== 'undefined' && window.innerWidth <= 768;
  });
  const [isMobileTableOpen, setIsMobileTableOpen] = useState(false);

  const toggleViewMode = () => {
    setIsMobileView(prev => {
      const next = !prev;
      localStorage.setItem('view_mode', next ? 'mobile' : 'desktop');
      return next;
    });
  };

  useEffect(() => {
    fetchBackendVersion().then(v => {
      if (v) setBackendVersion(v);
    });
  }, []);

  // Проверка сессии пользователя при старте
  useEffect(() => {
    let isMounted = true;
    fetchCurrentUser()
      .then(user => {
        if (isMounted) {
          setCurrentUser(user);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentUser(null);
          setAuthLoading(false);
          setLoading(false);
        }
      });
    return () => { isMounted = false; };
  }, []);

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

  // === Состояние для toast-ов с автозакрытием ===
  type Toast = {
    id: string;
    uniqueId: string;
    type: 'info' | 'warning' | 'error' | 'holidays';
    message: React.ReactNode;
    action?: { label: string; handler: () => void };
    duration?: number;
  };
  const [toastQueue, setToastQueue] = useState<Toast[]>([]);
  const toastIdCounter = useRef(0);
  const activeToasts = useRef<Set<string>>(new Set());
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    activeToasts.current.delete(id);
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
    setToastQueue(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((id: string, toast: Omit<Toast, 'id' | 'uniqueId'>) => {
    if (activeToasts.current.has(id)) return;
    activeToasts.current.add(id);
    const uniqueId = `${Date.now()}-${toastIdCounter.current++}`;
    setToastQueue(prev => [...prev, { ...toast, id, uniqueId }]);

    // Автоматическое закрытие по таймеру (3.5 сек по умолчанию)
    // Не закрываем автоматически фоновые процессы загрузки
    const isPersistent = id === 'syncing' || id === 'holidays-loading' || toast.duration === 0;
    if (!isPersistent) {
      const timeoutMs = toast.duration ?? 3500;
      const timer = setTimeout(() => {
        removeToast(id);
      }, timeoutMs);
      toastTimers.current.set(id, timer);
    }
  }, [removeToast]);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach(timer => clearTimeout(timer));
      toastTimers.current.clear();
    };
  }, []);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Сброс данных при выходе пользователя
  useEffect(() => {
    if (!currentUser) {
      setTasks([]);
      setAllTags([]);
      setTaskTagsMap(new Map());
      setAllPriorities([]);
    }
  }, [currentUser]);

  // === Загрузка задач и тегов ===
  const loadTasksForRange = useCallback(async (from: string, to: string) => {
    if (!currentUser) return [];
    try {
      const newTasks = await fetchTasksRange(from, to);
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.task_id));
        const uniqueNew = newTasks.filter(t => !existingIds.has(t.task_id));
        return [...prev, ...uniqueNew];
      });
      return newTasks;
    } catch (err: any) {
      if (err?.status === 401) {
        setCurrentUser(null);
        return [];
      }
      console.error('Failed to load range', err);
      addToast('error-load-tasks', { type: 'error', message: `Ошибка загрузки задач: ${err?.message || err}` });
      return [];
    }
  }, [currentUser, addToast]);

  // === Полное обновление задач за период (слияние без мерцания) ===
  const refreshTasksForRange = useCallback(async (from: string, to: string) => {
    if (!currentUser) return [];
    try {
      const fetchedTasks = await fetchTasksRange(from, to);
      setTasks(prev => {
        const fetchedMap = new Map(fetchedTasks.map(t => [t.task_id, t]));
        const updated = prev.map(t => fetchedMap.get(t.task_id) || t);
        const existingIds = new Set(prev.map(t => t.task_id));
        for (const t of fetchedTasks) {
          if (!existingIds.has(t.task_id)) {
            updated.push(t);
          }
        }
        return updated;
      });
      return fetchedTasks;
    } catch (err: any) {
      if (err?.status === 401) {
        setCurrentUser(null);
        return [];
      }
      console.error('Failed to refresh tasks range', err);
      addToast('error-refresh-tasks', { type: 'error', message: `Ошибка обновления задач: ${err?.message || err}` });
      return [];
    }
  }, [currentUser, addToast]);

  const loadTagsData = useCallback(async () => {
    if (!currentUser) return;
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
      if (err?.status === 401) {
        setCurrentUser(null);
        return;
      }
      console.error('Failed to load tags data', err);
      addToast('error-load-tags', { type: 'error', message: `Ошибка загрузки тегов: ${err?.message || err}` });
    }
  }, [currentUser, addToast]);

  const loadPrioritiesData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const priorities = await fetchAllPriorities();
      setAllPriorities(priorities);
    } catch (err: any) {
      if (err?.status === 401) {
        setCurrentUser(null);
        return;
      }
      console.error('Failed to load priorities data', err);
      addToast('error-load-priorities', { type: 'error', message: `Ошибка загрузки приоритетов: ${err?.message || err}` });
    }
  }, [currentUser, addToast]);

  // === Обновление задач (ручное или автоматическое фоновое) ===
  const handleRefreshTasks = useCallback(async (isSilent = false) => {
    if (!currentUser) return;
    if (!isSilent) setRefreshing(true);
    try {
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
    } catch (err: any) {
      if (err?.status === 401) {
        setCurrentUser(null);
        return;
      }
      console.error('Failed to refresh tasks', err);
      if (!isSilent) {
        addToast('error-refresh', { type: 'error', message: `Ошибка обновления: ${err?.message || err}` });
      }
    } finally {
      if (!isSilent) {
        setTimeout(() => setRefreshing(false), 400);
      }
    }
  }, [currentUser, refreshTasksForRange, loadTagsData, loadPrioritiesData, addToast]);

  // === Инициализация данных только при наличии авторизованного пользователя ===
  useEffect(() => {
    if (!currentUser) return;
    handleRefreshTasks(true).finally(() => setLoading(false));
  }, [currentUser, handleRefreshTasks]);

  // === Автоматическая периодическая фоновая синхронизация с сервером (раз в 20 сек) только для авторизованного пользователя ===
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      handleRefreshTasks(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [currentUser, handleRefreshTasks]);

  const handleHolidaysLoadingChange = useCallback((loading: boolean) => {
    if (loading) {
      addToast('holidays-loading', {
        type: 'holidays',
        message: (
          <>
            <RefreshCw size={16} className="spin-icon" />
            <div className="toast-text">Загружаем праздники...</div>
          </>
        ),
      });
    } else {
      removeToast('holidays-loading');
    }
  }, [addToast, removeToast]);

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

  const handleSelectTaskById = useCallback(async (taskId: number) => {
    let task = tasks.find(t => t.task_id === taskId);
    if (!task) {
      try {
        task = await fetchTaskById(taskId);
      } catch (err: any) {
        console.error('Failed to fetch task by id', err);
        addToast('error-fetch-task', {
          type: 'error',
          message: `Не удалось загрузить задачу #${taskId}: ${err?.message || err}`,
        });
        return;
      }
    }
    if (task) {
      setModalState({ isOpen: true, task });
    }
  }, [tasks, addToast]);

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

  const handleSaveTask = (taskData: Omit<Task, 'task_id'>) => {
    if (modalState.task) {
      // Редактирование: моментально закрываем модалку и обновляем локальный стейт
      const taskId = modalState.task.task_id;
      const previousTask = tasks.find(t => t.task_id === taskId);
      const updateDto: UpdateTaskDTO = {
        task_id: taskId,
        title: taskData.title ?? undefined,
        description: taskData.description ?? undefined,
        link_to_taskmanager: taskData.link_to_taskmanager ?? undefined,
        due_date: taskData.due_date ?? undefined,
        closed_dttm: taskData.closed_dttm ?? undefined,
        task_status: taskData.task_status ?? undefined,
        task_priority_id: taskData.task_priority_id ?? undefined,
      };

      setModalState({ isOpen: false });
      setTasks(prev => prev.map(t => (t.task_id === taskId ? { ...t, ...taskData } : t)));

      updateTask(taskId, updateDto)
        .then(updated => {
          setTasks(prev => prev.map(t => (t.task_id === taskId ? { ...t, ...taskData, ...updated } : t)));
        })
        .catch((err: any) => {
          console.error('Failed to update task', err);
          if (previousTask) {
            setTasks(prev => prev.map(t => (t.task_id === taskId ? previousTask : t)));
          }
          addToast(`error-task-save-${taskId}`, {
            type: 'error',
            message: `Ошибка сохранения задачи: ${err?.message || err}`,
          });
        });
    } else {
      // Создание: моментально добавляем задачу с временным отрицательным id
      // shortcut: temporary negative ID until server confirms, sufficient for single user session
      const tempId = -Date.now();
      const optimisticTask: Task = {
        task_id: tempId,
        title: taskData.title,
        description: taskData.description ?? null,
        link_to_taskmanager: taskData.link_to_taskmanager ?? null,
        due_date: taskData.due_date ?? null,
        task_status: taskData.task_status ?? 1,
        closed_dttm: taskData.closed_dttm ?? null,
        task_priority_id: taskData.task_priority_id ?? null,
        created_at: new Date().toISOString(),
      };

      setModalState({ isOpen: false });
      setTasks(prev => [...prev, optimisticTask]);

      const createDto: CreateTaskDTO = {
        title: taskData.title,
        description: taskData.description ?? null,
        link_to_taskmanager: taskData.link_to_taskmanager ?? null,
        due_date: taskData.due_date ?? undefined,
        task_status: taskData.task_status ?? null,
        task_priority_id: taskData.task_priority_id ?? null,
      };

      createTask(createDto)
        .then(created => {
          setTasks(prev => prev.map(t => (t.task_id === tempId ? { ...t, ...created } : t)));
        })
        .catch((err: any) => {
          console.error('Failed to create task', err);
          setTasks(prev => prev.filter(t => t.task_id !== tempId));
          addToast(`error-task-create-${tempId}`, {
            type: 'error',
            message: `Ошибка создания задачи "${taskData.title}": ${err?.message || err}`,
          });
        });
    }
  };

  const handleDeleteTask = (taskId: number) => {
    if (window.confirm('Удалить задачу?')) {
      const taskToDelete = tasks.find(t => t.task_id === taskId);
      if (modalState.task?.task_id === taskId) {
        setModalState({ isOpen: false });
      }
      // Моментально убираем из интерфейса
      setTasks(prev => prev.filter(t => t.task_id !== taskId));

      deleteTask(taskId).catch((err: any) => {
        console.error('Failed to delete task', err);
        if (taskToDelete) {
          setTasks(prev => [...prev, taskToDelete]);
        }
        addToast(`error-task-delete-${taskId}`, {
          type: 'error',
          message: `Ошибка удаления задачи: ${err?.message || err}`,
        });
      });
    }
  };

  const handleMoveTask = (taskId: number, newDueDate: string) => {
    const taskToUpdate = tasks.find(t => t.task_id === taskId);
    if (!taskToUpdate) return;
    const oldDueDate = taskToUpdate.due_date;
    // Моментально обновляем положение карточки
    setTasks(prev => prev.map(t => (t.task_id === taskId ? { ...t, due_date: newDueDate } : t)));

    const updateDto: UpdateTaskDTO = {
      task_id: taskId,
      title: taskToUpdate.title,
      description: taskToUpdate.description,
      link_to_taskmanager: taskToUpdate.link_to_taskmanager,
      due_date: newDueDate,
      task_status: taskToUpdate.task_status,
      task_priority_id: taskToUpdate.task_priority_id ?? null,
    };

    updateTask(taskId, updateDto).catch((err: any) => {
      console.error('Failed to move task', err);
      setTasks(prev => prev.map(t => (t.task_id === taskId ? { ...t, due_date: oldDueDate } : t)));
      addToast(`error-task-move-${taskId}`, {
        type: 'error',
        message: `Ошибка переноса задачи: ${err?.message || err}`,
      });
    });
  };

  const handleToggleStatus = (taskId: number, newStatus: number) => {
    const taskToUpdate = tasks.find(t => t.task_id === taskId);
    if (!taskToUpdate) return;
    const oldStatus = taskToUpdate.task_status;
    const oldClosedDttm = taskToUpdate.closed_dttm;
    const newClosedDttm = newStatus === 2 ? new Date().toISOString() : null;

    // Моментально переключаем статус выполнения
    setTasks(prev =>
      prev.map(t => (t.task_id === taskId ? { ...t, task_status: newStatus, closed_dttm: newClosedDttm } : t))
    );

    const updateDto: UpdateTaskDTO = {
      task_id: taskId,
      title: taskToUpdate.title,
      description: taskToUpdate.description,
      link_to_taskmanager: taskToUpdate.link_to_taskmanager,
      due_date: taskToUpdate.due_date,
      task_status: newStatus,
      closed_dttm: newClosedDttm,
      task_priority_id: taskToUpdate.task_priority_id ?? null,
    };

    updateTask(taskId, updateDto).catch((err: any) => {
      console.error('Failed to toggle status', err);
      setTasks(prev =>
        prev.map(t => (t.task_id === taskId ? { ...t, task_status: oldStatus, closed_dttm: oldClosedDttm } : t))
      );
      addToast(`error-task-status-${taskId}`, {
        type: 'error',
        message: `Ошибка изменения статуса: ${err?.message || err}`,
      });
    });
  };

  const closeModal = () => setModalState({ isOpen: false });

  const handleAssignTag = useCallback((tagId: number) => {
    if (!modalState.task) return;
    const taskId = modalState.task.task_id;
    const tag = allTags.find(t => t.task_tag_id === tagId);
    if (!tag) return;

    // Моментально добавляем тег в локальную мапу
    setTaskTagsMap(prev => {
      const next = new Map(prev);
      const cur = next.get(taskId) || [];
      if (!cur.some(t => t.task_tag_id === tagId)) {
        next.set(taskId, [...cur, tag]);
      }
      return next;
    });

    assignTagToTask(tagId, taskId).catch((err: any) => {
      console.error('Failed to assign tag', err);
      // Откат при ошибке
      setTaskTagsMap(prev => {
        const next = new Map(prev);
        const cur = next.get(taskId) || [];
        next.set(taskId, cur.filter(t => t.task_tag_id !== tagId));
        return next;
      });
      addToast(`error-tag-assign-${tagId}`, {
        type: 'error',
        message: `Ошибка назначения тега: ${err?.message || err}`,
      });
    });
  }, [modalState.task, allTags, addToast]);

  const handleRemoveTagFromTask = useCallback((taskId: number, tagId: number) => {
    const prevTags = taskTagsMap.get(taskId) || [];
    // Моментально отвязываем тег
    setTaskTagsMap(prev => {
      const next = new Map(prev);
      const cur = next.get(taskId) || [];
      next.set(taskId, cur.filter(t => t.task_tag_id !== tagId));
      return next;
    });

    unassignTagFromTask(tagId, taskId).catch((err: any) => {
      console.error('Failed to remove tag from task', err);
      // Откат при ошибке
      setTaskTagsMap(prev => new Map(prev).set(taskId, prevTags));
      addToast(`error-tag-remove-${tagId}`, {
        type: 'error',
        message: `Ошибка отвязки тега: ${err?.message || err}`,
      });
    });
  }, [taskTagsMap, addToast]);

  const handleCreateTag = useCallback(async (tagText: string, tagColor: string) => {
    try {
      await createTag(tagText, tagColor);
      await loadTagsData();
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
    } catch (err: any) {
      console.error('Failed to update tag', err);
      addToast('error-tag-update', {
        type: 'error',
        message: `Ошибка обновления тега: ${err?.message || err}`,
      });
    }
  }, [loadTagsData, addToast]);

  const handleDeleteTagGlobally = useCallback(async (tagId: number) => {
    const prevTags = allTags;
    // Моментально убираем из списка тегов
    setAllTags(prev => prev.filter(t => t.task_tag_id !== tagId));
    try {
      await deleteTagGlobally(tagId);
      await loadTagsData();
    } catch (err: any) {
      setAllTags(prevTags);
      console.error('Failed to delete tag globally', err);
      addToast('error-tag-delete', {
        type: 'error',
        message: `Ошибка удаления тега: ${err?.message || err}`,
      });
    }
  }, [allTags, loadTagsData, addToast]);

  const handleCreatePriority = useCallback(async (name: string, color: string, weight: number) => {
    try {
      await createPriority({ priority_name: name, priority_color: color, priority_sorting_weight: weight });
      await loadPrioritiesData();
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
    } catch (err: any) {
      console.error('Failed to update priority', err);
      addToast('error-priority-update', {
        type: 'error',
        message: `Ошибка обновления приоритета: ${err?.message || err}`,
      });
    }
  }, [loadPrioritiesData, addToast]);

  const handleDeletePriority = useCallback(async (priorityId: number) => {
    const prevPriorities = allPriorities;
    // Моментально убираем из списка приоритетов
    setAllPriorities(prev => prev.filter(p => p.priority_id !== priorityId));
    try {
      await deletePriority(priorityId);
      await loadPrioritiesData();
    } catch (err: any) {
      setAllPriorities(prevPriorities);
      console.error('Failed to delete priority', err);
      addToast('error-priority-delete', {
        type: 'error',
        message: `Ошибка удаления приоритета: ${err?.message || err}`,
      });
    }
  }, [allPriorities, loadPrioritiesData, addToast]);

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <Loader2 className="spin-loader" size={32} />
        <span className="auth-loading-text">Проверка авторизации...</span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen
        onSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="calendar-loading-screen">
        <Loader2 className="spin-loader" size={36} />
        <span className="calendar-loading-text">Загрузка задач...</span>
      </div>
    );
  }

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
          <div className="title-section" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/favicon.svg" alt="Task-o-Saurus" style={{ width: 34, height: 34, borderRadius: 8 }} />
            <h1>Task-o-Saurus</h1>
          </div>
          <div className="nav-buttons">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 16,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--text-color, #4f46e5)',
                fontSize: 12,
                fontWeight: 600,
                marginRight: 6,
              }}
            >
              <UserIcon size={14} />
              <span>{currentUser.username}</span>
              {currentUser.role === 'admin' && (
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#f59e0b', color: '#fff', textTransform: 'uppercase', fontWeight: 700 }}>
                  Admin
                </span>
              )}
            </div>

            {currentUser.role === 'admin' && (
              <button
                className="nav-btn"
                onClick={() => setIsUsersModalOpen(true)}
                title="Панель администратора"
                style={{ marginRight: 4 }}
              >
                <Users size={18} />
              </button>
            )}

            <button
              className="nav-btn"
              onClick={() => setIsBackupModalOpen(true)}
              title="Экспорт и импорт данных (JSON)"
              style={{ marginRight: 4 }}
            >
              <ArrowUpDown size={18} />
            </button>

            <button
              className="nav-btn"
              onClick={async () => {
                try {
                  await logoutUser();
                } finally {
                  setCurrentUser(null);
                }
              }}
              title="Выйти"
              style={{ marginRight: 6 }}
            >
              <LogOut size={18} />
            </button>

            <button
              className="nav-btn"
              onClick={toggleViewMode}
              title={isMobileView ? "Переключить на горизонтальный календарь" : "Переключить на мобильный вид"}
              style={{ marginRight: 4 }}
            >
              {isMobileView ? <Monitor size={18} /> : <Smartphone size={18} />}
            </button>

            <button className="nav-btn theme-toggle-btn" onClick={toggleTheme} title={isDark ? 'Светлая тема' : 'Темная тема'}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="nav-btn" onClick={() => calendarRef.current?.scrollLeft()} title="Влево / Предыдущий день">
              <ChevronLeft size={20} />
            </button>
            <button className="nav-btn" onClick={() => calendarRef.current?.scrollRight()} title="Вправо / Следующий день">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        {isMobileView ? (
          <MobileCalendarView
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
            onHolidaysLoadingChange={handleHolidaysLoadingChange}
          />
        ) : (
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
            onHolidaysLoadingChange={handleHolidaysLoadingChange}
          />
        )}
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
        {isMobileView ? (
          <>
            <button
              className="mobile-table-toggle-btn"
              onClick={() => setIsMobileTableOpen(prev => !prev)}
            >
              <span>{isMobileTableOpen ? 'Скрыть таблицу всех задач' : `Показать общую таблицу задач (${filteredTasks.length})`}</span>
              {isMobileTableOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {isMobileTableOpen && (
              <TaskList
                tasks={filteredTasks}
                taskTagsMap={taskTagsMap}
                onTaskClick={handleTaskClickFromList}
                onToggleStatus={handleToggleStatus}
                onEditTask={handleEditTask}
                onDeleteTask={(task) => handleDeleteTask(task.task_id)}
              />
            )}
          </>
        ) : (
          <TaskList
            tasks={filteredTasks}
            taskTagsMap={taskTagsMap}
            onTaskClick={handleTaskClickFromList}
            onToggleStatus={handleToggleStatus}
            onEditTask={handleEditTask}
            onDeleteTask={(task) => handleDeleteTask(task.task_id)}
          />
        )}
        <footer className="app-footer">
          <div className="footer-hint">
            {isMobileView
              ? 'Тап по задаче – редактировать, чекбокс – выполнить.'
              : 'Клик по дню – новая задача, по названию – редактировать.'}
          </div>
          <div className="footer-meta">
            <span className="footer-versions">
              Web v{packageJson.version} &bull; API {backendVersion ? `v${backendVersion}` : '...'}
            </span>
            <span className="footer-divider">•</span>
            <span className="footer-issues">
              Issues:
              {' '}
              <a
                href="https://github.com/bitoche/taskozaurus_webui/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                Frontend
              </a>
              {' / '}
              <a
                href="https://github.com/bitoche/taskozaurus_taskmanager/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                Backend
              </a>
            </span>
          </div>
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
        <button className="today-btn-fixed" onClick={scrollToToday} title="Перейти к сегодняшнему дню">
          <Home size={20} />
        </button>
        <button className="sql-btn-fixed" onClick={() => setIsSqlModalOpen(true)} title="SQL-запрос задач">
          <Database size={20} />
        </button>
        <button className={`sync-btn ${refreshing ? 'sync-btn-loading' : ''}`} onClick={() => handleRefreshTasks(false)} disabled={refreshing} title="Обновить список задач">
          <RefreshCw size={20} className={refreshing ? 'spin-icon' : ''} />
        </button>
      </div>

      <SqlQueryModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        onSelectTask={handleSelectTaskById}
        user={currentUser}
      />

      {currentUser?.role === 'admin' && (
        <AdminUsersModal
          isOpen={isUsersModalOpen}
          onClose={() => setIsUsersModalOpen(false)}
          currentAdminId={currentUser.user_id}
          onNotify={(type, msg) => addToast(`admin-${Date.now()}`, { type, message: msg })}
          onRefreshData={() => handleRefreshTasks(true)}
        />
      )}

      {currentUser && (
        <DataBackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          username={currentUser.username}
          onNotify={(type, msg) => addToast(`backup-${Date.now()}`, { type, message: msg })}
          onRefreshData={() => handleRefreshTasks(true)}
        />
      )}

      <div className="toast-container">
        {toastQueue.map((toast, index) => (
          <div key={toast.uniqueId} className={`toast toast-${toast.type}`} style={{ animationDelay: `${index * 0.05}s` }}>
            <span className="toast-message">{toast.message}</span>
            {toast.action && (
              <button onClick={toast.action.handler} className="toast-btn">
                {toast.action.label}
              </button>
            )}
            <button
              className="toast-close-btn"
              onClick={() => removeToast(toast.id)}
              title="Закрыть уведомление"
              aria-label="Закрыть"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default App;
