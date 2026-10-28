import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from 'react';

import DayCard, { DayCardTask } from './DayCard';
import { Task, TaskTag, TaskPriority } from '../types';
import { getDaysInfo, getLocalWeekends } from '../holidays';
import { getTaskClosedDateKey, getCompletionDiff } from '../utils/taskDate';
import { Loader2 } from 'lucide-react';
import './CalendarStrip.css';

const INITIAL_DAYS_BEFORE = 7;
const INITIAL_DAYS_AFTER = 23;
const LOAD_MORE_DAYS = 7;

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

interface Props {
  tasks: Task[];
  onAddTask: (date: string) => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: number, newDueDate: string, sourceDate?: string) => void;
  onLoadRange: (from: string, to: string) => Promise<Task[]>;
  onToggleStatus: (taskId: number, newStatus: number) => void;
  taskTagsMap?: Map<number, TaskTag[]>;
  onRemoveTag?: (taskId: number, tagId: number) => void;
  allPriorities?: TaskPriority[];
  onHolidaysLoadingChange?: (loading: boolean) => void; // callback для тоста
}

export interface CalendarStripRef {
  scrollToDate: (dateStr: string, taskId?: number) => void;
  scrollLeft: () => void;
  scrollRight: () => void;
  getDateRange?: () => { from: string; to: string } | null;
}

const CalendarStrip = forwardRef<CalendarStripRef, Props>(({
  tasks,
  onAddTask,
  onEditTask,
  onMoveTask,
  onLoadRange,
  onToggleStatus,
  taskTagsMap,
  onRemoveTag,
  allPriorities,
  onHolidaysLoadingChange,
}, ref) => {
  const [dates, setDates] = useState<Date[]>([]);
  const [loadedDateKeys, setLoadedDateKeys] = useState<Set<string>>(new Set());
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);
  const [loadingLeft, setLoadingLeft] = useState(false);
  const [loadingRight, setLoadingRight] = useState(false);
  const [daysOffMap, setDaysOffMap] = useState<Map<string, boolean>>(new Map());
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const stripRef = useRef<HTMLDivElement>(null);
  const datesRef = useRef<Date[]>([]);
  const isReloadingLeft = useRef(false);
  const anchorDateRef = useRef<string | null>(null);
  const anchorLeftRef = useRef<number | null>(null);
  const prevScrollWidthRef = useRef<number | null>(null);
  const prevScrollLeftRef = useRef<number | null>(null);

  const initialized = useRef(false);

  const todayStr = formatLocalDate(getTodayDate());

  useLayoutEffect(() => {
    datesRef.current = dates;
    
    // Восстанавливаем позицию скролла после рендера новых элементов слева
    if (isReloadingLeft.current && stripRef.current) {
      let delta = 0;
      if (anchorDateRef.current && anchorLeftRef.current !== null) {
        const anchorEl = stripRef.current.querySelector<HTMLElement>(
          `.day-card[data-date="${anchorDateRef.current}"]`
        );
        if (anchorEl) {
          // Реальный сдвиг карточки-якоря в пикселях через getBoundingClientRect
          const newLeft = anchorEl.getBoundingClientRect().left;
          delta = newLeft - anchorLeftRef.current;
        }
      }
      // Запасной расчет через изменение scrollWidth, если getBoundingClientRect недоступен
      if (delta === 0 && prevScrollWidthRef.current !== null) {
        delta = stripRef.current.scrollWidth - prevScrollWidthRef.current;
      }

      if (delta !== 0) {
        const targetScrollLeft = (prevScrollLeftRef.current ?? stripRef.current.scrollLeft) + delta;
        stripRef.current.scrollLeft = targetScrollLeft;
      }

      isReloadingLeft.current = false;
      anchorDateRef.current = null;
      anchorLeftRef.current = null;
      prevScrollWidthRef.current = null;
      prevScrollLeftRef.current = null;
    }
  }, [dates]);

  // =========================
  // INITIAL LOAD (30 дней)
  // =========================
  useEffect(() => {
    if (initialized.current) return;

    const today = getTodayDate();
    const start = addDays(today, -INITIAL_DAYS_BEFORE);
    const end = addDays(today, INITIAL_DAYS_AFTER);

    const newDates: Date[] = [];
    let cur = new Date(start);
    while (cur <= end) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    setDates(newDates);
    setLoadedDateKeys(new Set(newDates.map((d) => formatLocalDate(d))));
    onLoadRange(formatLocalDate(start), formatLocalDate(end));

    // Сначала загружаем локальные выходные (суббота, воскресенье)
    const localWeekends = getLocalWeekends(start, end);
    setDaysOffMap(localWeekends);
    
    // Показываем индикатор загрузки праздников
    onHolidaysLoadingChange?.(true);
    
    // Загружаем информацию о выходных/праздниках через API
    getDaysInfo(start, end).then(map => {
      // Объединяем: API данные + локальные выходные (если API не вернул данные)
      setDaysOffMap(prev => {
        const merged = new Map(prev);
        map.forEach((isDayOff, dateStr) => {
          merged.set(dateStr, isDayOff);
        });
        return merged;
      });
      onHolidaysLoadingChange?.(false);
    }).catch(err => {
      console.error('Failed to load holidays:', err);
      setDaysOffMap(prev => new Map([...prev, ...getLocalWeekends(start, end)]));
      onHolidaysLoadingChange?.(false);
    });

    initialized.current = true;
    setIsInitialized(true);
  }, [onLoadRange, onHolidaysLoadingChange]);

  // Прокрутка к сегодняшнему дню (только при первой загрузке)
  useEffect(() => {
    console.log('[CalendarStrip] scroll effect:', { isInitialized, hasScrolledToToday, dates: dates.length, todayStr });
    if (!isInitialized || !stripRef.current || hasScrolledToToday || dates.length === 0) return;

    const strip = stripRef.current;
    const todayCard = strip.querySelector(`[data-date="${todayStr}"]`) as HTMLElement | null;
    console.log('[CalendarStrip] todayCard:', todayCard);
    if (!todayCard) return;

    // Даём время на рендер и применяем прокрутку
    setTimeout(() => {
      console.log('[CalendarStrip] scrolling to today');
      strip.scrollTo({
        left: Math.max(0, todayCard.offsetLeft - 46),
        behavior: 'smooth',
      });
      setHasScrolledToToday(true);
    }, 100);
  }, [isInitialized, hasScrolledToToday, todayStr]);

  // =========================
  // LOAD LEFT
  // =========================
  const handleLoadLeft = useCallback(async () => {
    if (loadingLeft || dates.length === 0) return;
    setLoadingLeft(true);
    
    const firstDate = dates[0];
    const newFirst = addDays(firstDate, -LOAD_MORE_DAYS);
    const newDates: Date[] = [];
    let cur = new Date(newFirst);
    while (cur < firstDate) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    const fromKey = formatLocalDate(newFirst);
    const toKey = formatLocalDate(addDays(firstDate, -1));
    await onLoadRange(fromKey, toKey);
    
    // Загружаем информацию о выходных/праздниках для нового диапазона
    onHolidaysLoadingChange?.(true);
    getDaysInfo(newFirst, firstDate).then(map => {
      setDaysOffMap(prev => new Map([...prev, ...map]));
      onHolidaysLoadingChange?.(false);
    }).catch(err => {
      console.error('Failed to load holidays:', err);
      setDaysOffMap(prev => new Map([...prev, ...getLocalWeekends(newFirst, firstDate)]));
      onHolidaysLoadingChange?.(false);
    });
    
    // Фиксируем положение текущей первой карточки перед добавлением новых дат в DOM
    const anchorDateStr = formatLocalDate(firstDate);
    const anchorEl = stripRef.current?.querySelector<HTMLElement>(`.day-card[data-date="${anchorDateStr}"]`);
    anchorDateRef.current = anchorDateStr;
    anchorLeftRef.current = anchorEl ? anchorEl.getBoundingClientRect().left : null;
    prevScrollWidthRef.current = stripRef.current?.scrollWidth ?? null;
    prevScrollLeftRef.current = stripRef.current?.scrollLeft ?? null;
    isReloadingLeft.current = true;
    
    setDates((prev) => [...newDates, ...prev]);
    
    setLoadedDateKeys((prev) => {
      const next = new Set(prev);
      newDates.forEach((d) => next.add(formatLocalDate(d)));
      return next;
    });

    setLoadingLeft(false);
  }, [dates, onLoadRange, loadingLeft, onHolidaysLoadingChange]);

  // =========================
  // LOAD RIGHT
  // =========================
  const handleLoadRight = useCallback(async () => {
    if (loadingRight || dates.length === 0) return;
    setLoadingRight(true);
    
    const lastDate = dates[dates.length - 1];
    const newLast = addDays(lastDate, LOAD_MORE_DAYS);
    const newDates: Date[] = [];
    let cur = addDays(lastDate, 1);
    while (cur <= newLast) {
      newDates.push(new Date(cur));
      cur = addDays(cur, 1);
    }

    setDates((prev) => [...prev, ...newDates]);
    
    setLoadedDateKeys((prev) => {
      const next = new Set(prev);
      newDates.forEach((d) => next.add(formatLocalDate(d)));
      return next;
    });

    const fromKey = formatLocalDate(addDays(lastDate, 1));
    const toKey = formatLocalDate(newLast);
    await onLoadRange(fromKey, toKey);
    
    // Загружаем информацию о выходных/праздниках для нового диапазона
    onHolidaysLoadingChange?.(true);
    getDaysInfo(lastDate, newLast).then(map => {
      setDaysOffMap(prev => new Map([...prev, ...map]));
      onHolidaysLoadingChange?.(false);
    }).catch(err => {
      console.error('Failed to load holidays:', err);
      setDaysOffMap(prev => new Map([...prev, ...getLocalWeekends(lastDate, newLast)]));
      onHolidaysLoadingChange?.(false);
    });
    
    setLoadingRight(false);
  }, [dates, onLoadRange, loadingRight]);

  // =========================
  // DRAG SCROLL + WHEEL
  // =========================
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        strip.scrollLeft += e.deltaY * 2.5;
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        strip.scrollLeft += e.deltaX;
      }
    };
    strip.addEventListener('wheel', handleWheel, { passive: false });

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.task-item')) return;
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.pageX;
      startScrollLeft = strip.scrollLeft;
      strip.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      strip.scrollLeft = startScrollLeft - (e.pageX - startX);
    };
    const handleMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      strip.style.cursor = 'grab';
    };

    strip.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    strip.style.cursor = 'grab';

    return () => {
      strip.removeEventListener('wheel', handleWheel);
      strip.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const navigateToDate = useCallback((dateStr: string, taskId?: number) => {
    if (!stripRef.current) return;
    const targetCard = stripRef.current.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null;
    if (targetCard) {
      stripRef.current.scrollTo({
        left: Math.max(0, targetCard.offsetLeft - 46),
        behavior: 'smooth',
      });
      if (taskId !== undefined) {
        setTimeout(() => {
          setHighlightedTaskId(taskId);
          setTimeout(() => setHighlightedTaskId(null), 2000);
        }, 300);
      }
    }
  }, []);

  // =========================
  // TASK GROUPING
  // =========================
  const groupTasksByDate = (): Map<string, DayCardTask[]> => {
    const map = new Map<string, DayCardTask[]>();
    const today = getTodayDate();
    const todayKey = formatLocalDate(today);
    
    for (const task of tasks) {
      let originalKey = '';
      if (task.due_date) {
        originalKey = task.due_date.slice(0, 10);
      }
      const isCompleted = task.task_status === 2;
      const isActive = task.task_status === 1;
      
      const closedKey = getTaskClosedDateKey(task.closed_dttm);

      // Определяем целевую дату отображения:
      // Завершенная задача всегда остается на дате закрытия (или на назначенной дате / сегодня, если closed_dttm отсутствует)
      let targetKey: string;
      if (isCompleted) {
        targetKey = closedKey || originalKey || todayKey;
      } else if (originalKey && isActive) {
        // Активная просроченная задача — показываем на сегодня
        const parts = originalKey.split('-');
        const dueDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        targetKey = dueDateObj < today ? todayKey : originalKey;
      } else {
        targetKey = originalKey;
      }
      
      let isOverdue = false;
      if (originalKey && isActive) {
        const parts = originalKey.split('-');
        const dueDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        isOverdue = dueDateObj < today;
      }
      
      // Показываем основную таску
      if (loadedDateKeys.has(targetKey) || targetKey === '') {
        if (!map.has(targetKey)) map.set(targetKey, []);
        // Вычисляем overdueClosed и earlyClosed для календаря
        const { overdueClosed, earlyClosed } = isCompleted
          ? getCompletionDiff(task.due_date, task.closed_dttm)
          : { overdueClosed: 0, earlyClosed: 0 };
        map.get(targetKey)!.push({ ...task, isGhost: false, overdueClosed, earlyClosed });
      }
      
      // Ghost-таска только для активных просроченных задач (не завершённых)
      if (isActive && isOverdue && originalKey && originalKey !== targetKey && loadedDateKeys.has(originalKey)) {
        if (!map.has(originalKey)) map.set(originalKey, []);
        map.get(originalKey)!.push({
          ...task,
          isGhost: true,
          ghostTargetDate: targetKey,
          overdueClosed: 0,
          earlyClosed: 0,
        });
      }
    }
    return map;
  };

  const taskMap = groupTasksByDate();

  // Карта весов приоритетов для сортировки
  const priorityWeightMap = new Map<number, number>();
  if (allPriorities) {
    for (const p of allPriorities) {
      priorityWeightMap.set(p.priority_id, p.priority_sorting_weight);
    }
  }

  // Сортировка задач внутри дня: по весу приоритета (ASC), затем по task_id (ASC)
  const sortTasksByPriority = (dayTasks: DayCardTask[]) => {
    return [...dayTasks].sort((a, b) => {
      const wA = a.task_priority_id != null ? (priorityWeightMap.get(a.task_priority_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      const wB = b.task_priority_id != null ? (priorityWeightMap.get(b.task_priority_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      if (wA !== wB) return wA - wB;
      return (a.task_id ?? 0) - (b.task_id ?? 0);
    });
  };

  useImperativeHandle(ref, () => ({
    scrollToDate: navigateToDate,
    scrollLeft: () => {
      if (stripRef.current) stripRef.current.scrollLeft -= 280;
    },
    scrollRight: () => {
      if (stripRef.current) stripRef.current.scrollLeft += 280;
    },
    getDateRange: () => {
      if (dates.length === 0) return null;
      return {
        from: formatLocalDate(dates[0]),
        to: formatLocalDate(dates[dates.length - 1]),
      };
    },
  }));

  return (
    <>
      <div className="strip-wrapper">
        <div className="calendar-strip" ref={stripRef}>
          <div 
            className={`load-more-card ${loadingLeft ? 'loading' : ''}`}
            onClick={!loadingLeft ? handleLoadLeft : undefined}
          >
            {loadingLeft ? (
              <Loader2 size={20} className="spinner" />
            ) : (
              <>
                <div className="load-more-icon">◀</div>
                <div className="load-more-text">Загрузить ранее</div>
              </>
            )}
          </div>
          {dates.map((date) => {
            const dateStr = formatLocalDate(date);
            const tasksForDay = sortTasksByPriority([...(taskMap.get(dateStr) || [])]);
            const isDayOff = daysOffMap.get(dateStr) || false;
            const holiday = isDayOff ? { date: dateStr, isDayOff: true } : null;
            return (
              <DayCard
                key={dateStr}
                date={date}
                tasks={tasksForDay}
                isToday={dateStr === todayStr}
                onAddTask={() => onAddTask(dateStr)}
                onEditTask={onEditTask}
                onMoveTask={onMoveTask}
                onToggleStatus={onToggleStatus}
                onGhostClick={navigateToDate}
                dateStr={dateStr}
                highlightedTaskId={highlightedTaskId}
                taskTagsMap={taskTagsMap}
                onRemoveTagFromTask={onRemoveTag}
                allPriorities={allPriorities}
                holiday={holiday}
              />
            );
          })}
          <div 
            className={`load-more-card ${loadingRight ? 'loading' : ''}`}
            onClick={!loadingRight ? handleLoadRight : undefined}
          >
            {loadingRight ? (
              <Loader2 size={20} className="spinner" />
            ) : (
              <>
                <div className="load-more-text">Загрузить позже</div>
                <div className="load-more-icon">▶</div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

export default CalendarStrip;
