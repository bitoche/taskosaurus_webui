import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Calendar,
  CalendarDays,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Gauge,
  ExternalLink,
} from 'lucide-react';
import { Task, TaskTag, TaskPriority } from '../types';
import { getDaysInfo, getLocalWeekends } from '../holidays';
import TaskTags from './TaskTags';
import { CalendarStripRef } from './CalendarStrip';
import { getContrastTextColor } from '../utils/color';
import './MobileCalendarView.css';

interface Props {
  tasks: Task[];
  onAddTask: (date: string) => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: number, newDueDate: string) => void;
  onLoadRange: (from: string, to: string) => Promise<Task[]>;
  onToggleStatus: (taskId: number, newStatus: number) => void;
  taskTagsMap?: Map<number, TaskTag[]>;
  onRemoveTag?: (taskId: number, tagId: number) => void;
  allPriorities?: TaskPriority[];
  onHolidaysLoadingChange?: (loading: boolean) => void;
}

function getTodayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString('ru-RU', { month: 'long' });
  const weekday = date.toLocaleString('ru-RU', { weekday: 'short' });
  return `${day} ${month}, ${weekday}`;
}

function formatWeekday(date: Date): string {
  const wd = date.toLocaleString('ru-RU', { weekday: 'short' });
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}

function getOverdueDays(dueDateStr: string | null | undefined): number {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dueDateStr.split('-');
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

export type MobileTask = Task & {
  isGhost?: boolean;
  ghostTargetDate?: string;
  overdueClosed?: number;
};

const MobileCalendarView = forwardRef<CalendarStripRef, Props>(({
  tasks,
  onAddTask,
  onEditTask,
  onToggleStatus,
  taskTagsMap,
  onRemoveTag,
  allPriorities,
  onLoadRange,
  onHolidaysLoadingChange,
}, ref) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => getTodayDate());
  const [viewMode, setViewMode] = useState<'day' | 'agenda' | 'nodate'>('day');
  const [dates, setDates] = useState<Date[]>([]);
  const [daysOffMap, setDaysOffMap] = useState<Map<string, boolean>>(new Map());
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);

  const stripRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const todayStr = formatLocalDate(getTodayDate());
  const selectedDateStr = formatLocalDate(selectedDate);

  // Инициализация диапазона дат (-14 дней .. +30 дней от сегодняшнего дня)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const today = getTodayDate();
    const start = addDays(today, -14);
    const end = addDays(today, 30);
    const dateList: Date[] = [];
    let cur = new Date(start);
    while (cur <= end) {
      dateList.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    setDates(dateList);

    const fromStr = formatLocalDate(start);
    const toStr = formatLocalDate(end);
    onLoadRange(fromStr, toStr);

    onHolidaysLoadingChange?.(true);
    getDaysInfo(start, end)
      .then(map => {
        setDaysOffMap(map);
      })
      .catch(() => {
        setDaysOffMap(getLocalWeekends(start, end));
      })
      .finally(() => {
        onHolidaysLoadingChange?.(false);
      });
  }, [onLoadRange, onHolidaysLoadingChange]);

  // Прокрутка выбранного чипа в центр ленты при изменении даты
  useEffect(() => {
    if (viewMode !== 'day' || !stripRef.current) return;
    const selectedEl = stripRef.current.querySelector<HTMLElement>(`[data-chip-date="${selectedDateStr}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDateStr, viewMode]);

  // Приоритеты
  const priorityMap = new Map<number, TaskPriority>();
  const priorityWeightMap = new Map<number, number>();
  if (allPriorities) {
    for (const p of allPriorities) {
      priorityMap.set(p.priority_id, p);
      priorityWeightMap.set(p.priority_id, p.priority_sorting_weight);
    }
  }

  // Группировка задач по датам с учетом переноса активных просроченных на СЕГОДНЯ
  const tasksByDate = new Map<string, MobileTask[]>();
  const noDateTasks: MobileTask[] = [];

  const today = getTodayDate();
  const todayKey = formatLocalDate(today);

  for (const t of tasks) {
    let originalKey = '';
    if (t.due_date) {
      originalKey = t.due_date.slice(0, 10);
    }
    const isCompleted = t.task_status === 2;
    const isActive = t.task_status !== 2;

    let isOverdue = false;
    if (originalKey && isActive) {
      const parts = originalKey.split('-');
      const dueDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      isOverdue = dueDateObj < today;
    }

    let overdueClosed = 0;
    if (isCompleted && t.due_date && t.closed_dttm) {
      const parts = t.due_date.split('-');
      const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const closed = new Date(t.closed_dttm);
      const diffDays = Math.ceil((closed.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      overdueClosed = diffDays > 0 ? diffDays : 0;
    }

    // Определяем целевую дату отображения
    let targetKey: string;
    if (isCompleted && t.closed_dttm) {
      // Завершённая задача с closed_dttm — показываем на дате закрытия
      targetKey = t.closed_dttm.slice(0, 10);
    } else if (originalKey && isActive && isOverdue) {
      // Активная просроченная задача переносится на СЕГОДНЯ
      targetKey = todayKey;
    } else {
      targetKey = originalKey;
    }

    if (!targetKey) {
      noDateTasks.push({ ...t, isGhost: false, overdueClosed });
    } else {
      if (!tasksByDate.has(targetKey)) {
        tasksByDate.set(targetKey, []);
      }
      tasksByDate.get(targetKey)!.push({ ...t, isGhost: false, overdueClosed });
    }

    // Ghost-таска только для активных просроченных задач на их оригинальной дате
    if (isActive && isOverdue && originalKey && originalKey !== targetKey) {
      if (!tasksByDate.has(originalKey)) {
        tasksByDate.set(originalKey, []);
      }
      tasksByDate.get(originalKey)!.push({
        ...t,
        isGhost: true,
        ghostTargetDate: targetKey,
        overdueClosed: 0,
      });
    }
  }

  // Сортировка задач внутри дня по приоритету (ghost-таски в конце)
  const sortTasks = (taskList: MobileTask[]) => {
    return [...taskList].sort((a, b) => {
      if (a.isGhost !== b.isGhost) return a.isGhost ? 1 : -1;
      const wA = a.task_priority_id != null ? (priorityWeightMap.get(a.task_priority_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      const wB = b.task_priority_id != null ? (priorityWeightMap.get(b.task_priority_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      if (wA !== wB) return wA - wB;
      return (a.task_id ?? 0) - (b.task_id ?? 0);
    });
  };

  const tasksForSelectedDay = sortTasks(tasksByDate.get(selectedDateStr) || []);

  const navigateDay = (offset: number) => {
    setSelectedDate(prev => addDays(prev, offset));
  };

  const jumpToToday = () => {
    setSelectedDate(getTodayDate());
    setViewMode('day');
  };

  useImperativeHandle(ref, () => ({
    scrollToDate: (dateStr: string, taskId?: number) => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        setSelectedDate(d);
        setViewMode('day');
        if (taskId) {
          setHighlightedTaskId(taskId);
          setTimeout(() => setHighlightedTaskId(null), 2500);
        }
      }
    },
    scrollLeft: () => navigateDay(-1),
    scrollRight: () => navigateDay(1),
  }));

  const isTodaySelected = selectedDateStr === todayStr;
  const isSelectedDayOff = daysOffMap.get(selectedDateStr) || false;

  const handleOpenLink = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (url) {
      window.open('https://' + url, '_blank', 'noopener,noreferrer');
    }
  };

  // Рендер карточки отдельной задачи в мобильном представлении
  const renderTaskItem = (task: MobileTask) => {
    if (task.isGhost) {
      return (
        <div
          key={`ghost-${task.task_id}`}
          className="mobile-task-card ghost-task"
          onClick={() => jumpToToday()}
          title="Просроченная задача перенесена на сегодня. Нажмите для перехода к сегодня."
        >
          <div className="mobile-task-content" style={{ paddingLeft: '4px' }}>
            <div className="mobile-task-header-row">
              <span className="overdue-badge" title="Перенесена на сегодня">
                <AlertCircle size={13} /> перенесена на сегодня
              </span>
            </div>
            <div className="mobile-task-title" style={{ fontStyle: 'italic', opacity: 0.85 }}>
              {task.title}
            </div>
            <div className="mobile-ghost-hint">Нажмите для перехода к сегодняшнему дню &rarr;</div>
          </div>
        </div>
      );
    }

    const isCompleted = task.task_status === 2;
    const isActive = task.task_status !== 2;
    const isHighlighted = highlightedTaskId === task.task_id;
    const overdue = getOverdueDays(task.due_date);
    const taskTags = taskTagsMap?.get(task.task_id) || [];
    const priority = task.task_priority_id != null ? priorityMap.get(task.task_priority_id) : null;
    const hasLink = task.link_to_taskmanager && task.link_to_taskmanager.trim() !== '';
    const overdueClosed = task.overdueClosed || 0;

    return (
      <div
        key={task.task_id}
        className={`mobile-task-card ${isCompleted ? 'completed' : ''} ${isHighlighted ? 'task-highlight' : ''}`}
        style={priority?.priority_color ? { borderLeft: `5px solid ${priority.priority_color}` } : undefined}
      >
        <button
          className="mobile-status-checkbox"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(task.task_id, isCompleted ? 1 : 2);
          }}
          title={isCompleted ? 'Отметить как невыполненную' : 'Отметить как выполненную'}
        >
          <CheckCircle2
            size={24}
            className={isCompleted ? 'status-icon completed' : 'status-icon incomplete'}
          />
        </button>

        <div className="mobile-task-content" onClick={() => onEditTask(task)}>
          <div className="mobile-task-header-row">
            {isActive && overdue > 0 && (
              <span className="overdue-badge" title={`Просрочено на ${overdue} дн.`}>
                <AlertCircle size={13} /> {overdue} дн.
              </span>
            )}
            {isCompleted && overdueClosed > 0 && (
              <span className="overdue-badge-closed" title={`Закрыто с опозданием на ${overdueClosed} дн.`}>
                <Gauge size={13} /> {overdueClosed} дн.
              </span>
            )}
            {priority && (
              <span
                className="mobile-priority-badge"
                style={{
                  backgroundColor: priority.priority_color,
                  color: getContrastTextColor(priority.priority_color),
                }}
              >
                {priority.priority_name}
              </span>
            )}
          </div>

          <div className="mobile-task-title">{task.title}</div>

          {taskTags.length > 0 && (
            <div className="mobile-task-tags">
              <TaskTags
                tags={taskTags}
                maxVisible={4}
                onRemove={onRemoveTag ? (tagId) => onRemoveTag(task.task_id, tagId) : undefined}
              />
            </div>
          )}
        </div>

        {hasLink && (
          <div className="mobile-task-actions">
            <button
              className="mobile-task-action-btn"
              onClick={(e) => handleOpenLink(e, task.link_to_taskmanager!)}
              title="Открыть ссылку"
            >
              <ExternalLink size={18} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Список дней для режима "Лента" (все дни с задачами + Сегодня)
  const allAgendaDateStrings = Array.from(
    new Set([
      ...Array.from(tasksByDate.entries())
        .filter(([_, list]) => list.some(t => !t.isGhost))
        .map(([d]) => d),
      todayStr,
    ])
  ).sort();

  return (
    <div className="mobile-calendar-container">
      {/* Переключатель режимов */}
      <div className="mobile-view-tabs">
        <button
          className={`mobile-tab-btn ${viewMode === 'day' ? 'active' : ''}`}
          onClick={() => setViewMode('day')}
        >
          <Calendar size={18} />
          <span>День</span>
        </button>
        <button
          className={`mobile-tab-btn ${viewMode === 'agenda' ? 'active' : ''}`}
          onClick={() => setViewMode('agenda')}
        >
          <CalendarDays size={18} />
          <span>Лента</span>
        </button>
        <button
          className={`mobile-tab-btn ${viewMode === 'nodate' ? 'active' : ''}`}
          onClick={() => setViewMode('nodate')}
        >
          <Inbox size={18} />
          <span>Без даты</span>
          {noDateTasks.length > 0 && (
            <span className="mobile-tab-badge">{noDateTasks.length}</span>
          )}
        </button>
      </div>

      {viewMode === 'day' && (
        <>
          {/* Верхний блок навигации по дням */}
          <div className="mobile-date-nav">
            <button
              className="mobile-nav-arrow"
              onClick={() => navigateDay(-1)}
              title="Предыдущий день"
            >
              <ChevronLeft size={22} />
            </button>

            <div className="mobile-nav-center" onClick={jumpToToday}>
              <div className="mobile-nav-date-text">{formatDisplayDate(selectedDate)}</div>
              {isTodaySelected ? (
                <div className="mobile-nav-today-badge">Сегодня</div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-hint)' }}>
                  Нажмите для перехода к сегодня
                </div>
              )}
            </div>

            <button
              className="mobile-nav-arrow"
              onClick={() => navigateDay(1)}
              title="Следующий день"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Горизонтальная лента чипов с днями недели */}
          <div className="mobile-date-strip" ref={stripRef}>
            {dates.map((date) => {
              const dStr = formatLocalDate(date);
              const isSelected = dStr === selectedDateStr;
              const isToday = dStr === todayStr;
              const isOff = daysOffMap.get(dStr) || false;
              const count = (tasksByDate.get(dStr) || []).filter(t => !t.isGhost).length;

              return (
                <div
                  key={dStr}
                  data-chip-date={dStr}
                  className={`mobile-date-chip ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} ${isOff ? 'is-weekend' : ''}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="mobile-chip-weekday">{formatWeekday(date)}</span>
                  <span className="mobile-chip-day">{date.getDate()}</span>
                  {count > 0 ? (
                    <span className="mobile-chip-badge">{count}</span>
                  ) : isOff ? (
                    <span className="mobile-chip-dot" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Карточка выбранного дня */}
          <div className={`mobile-day-card ${isTodaySelected ? 'today-card' : ''}`}>
            <div className="mobile-day-card-header">
              <div className="mobile-day-title-wrap">
                <div className="mobile-day-title">{formatDisplayDate(selectedDate)}</div>
                <div className="mobile-day-subtitle">
                  {isSelectedDayOff && <span className="mobile-holiday-pill">Выходной</span>}
                  <span>
                    {tasksForSelectedDay.filter(t => !t.isGhost).length > 0
                      ? `Задач: ${tasksForSelectedDay.filter(t => !t.isGhost).length}`
                      : 'Нет запланированных задач'}
                  </span>
                </div>
              </div>
            </div>

            {/* Большая удобная кнопка добавления задачи */}
            <button
              className="mobile-add-task-btn"
              onClick={() => onAddTask(selectedDateStr)}
            >
              <Plus size={20} />
              <span>Добавить задачу на этот день</span>
            </button>

            {/* Список задач дня */}
            {tasksForSelectedDay.length > 0 ? (
              <div className="mobile-tasks-list">
                {tasksForSelectedDay.map(renderTaskItem)}
              </div>
            ) : (
              <div className="mobile-empty-day">
                <div className="mobile-empty-icon">🦖</div>
                <div className="mobile-empty-text">На этот день ничего не запланировано</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Режим "Лента" (Agenda) */}
      {viewMode === 'agenda' && (
        <div className="mobile-agenda-container">
          {allAgendaDateStrings.map((dStr) => {
            const parts = dStr.split('-');
            const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            const isToday = dStr === todayStr;
            const dayTasks = sortTasks(tasksByDate.get(dStr) || []);
            const isOff = daysOffMap.get(dStr) || false;

            return (
              <div
                key={dStr}
                className={`mobile-agenda-day-group ${isToday ? 'is-today' : ''}`}
              >
                <div className="mobile-agenda-day-header">
                  <div className="mobile-agenda-day-title">
                    <span>{formatDisplayDate(dateObj)}</span>
                    {isToday && <span className="mobile-nav-today-badge">Сегодня</span>}
                    {isOff && <span className="mobile-holiday-pill">Выходной</span>}
                  </div>
                  <button
                    className="mobile-agenda-add-btn"
                    onClick={() => onAddTask(dStr)}
                    title="Добавить задачу"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {dayTasks.length > 0 ? (
                  <div className="mobile-tasks-list">
                    {dayTasks.map(renderTaskItem)}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-hint)', fontSize: '0.85rem', padding: '4px 0' }}>
                    Нет задач на этот день
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Режим "Без даты" */}
      {viewMode === 'nodate' && (
        <div className="mobile-nodate-container">
          <div className="mobile-nodate-header">
            <div className="mobile-nodate-title">Задачи без указания даты</div>
            <button
              className="mobile-add-task-btn"
              style={{ minHeight: '38px', padding: '8px 14px', fontSize: '0.85rem' }}
              onClick={() => onAddTask('')}
            >
              <Plus size={16} />
              <span>Добавить</span>
            </button>
          </div>

          {noDateTasks.length > 0 ? (
            <div className="mobile-tasks-list">
              {sortTasks(noDateTasks).map(renderTaskItem)}
            </div>
          ) : (
            <div className="mobile-empty-day">
              <div className="mobile-empty-icon">📁</div>
              <div className="mobile-empty-text">Все задачи распределены по датам!</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default MobileCalendarView;
