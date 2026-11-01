import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Task, TaskTag } from '../types';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
  flexRender,
} from '@tanstack/react-table';
import { CheckCircle2, AlertCircle, Gauge, Search, Edit, Trash2, ExternalLink, X } from 'lucide-react';
import { getCompletionDiff } from '../utils/taskDate';
import './TaskList.css';

interface Props {
  tasks: Task[];
  taskTagsMap: Map<number, TaskTag[]>;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: number, newStatus: number) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

type TaskRowData = Task & {
  isCompleted: boolean;
  overdue: number;
  overdueClosed: number;
  earlyClosed: number;
};

const COLUMN_MIN_SIZES: Record<string, number> = {
  title: 200,
  created_at: 155,
  due_date: 180,
  link: 80,
  task_status: 115,
  closed_dttm: 175,
  actions: 115,
};

const DEFAULT_COLUMN_SIZES: Record<string, number> = {
  created_at: 155,
  due_date: 180,
  link: 80,
  task_status: 115,
  closed_dttm: 175,
  actions: 115,
};

const RESIZABLE_DIVIDERS: Record<string, 'created_at' | 'due_date' | 'task_status' | 'closed_dttm'> = {
  title: 'created_at',        // Левая грань "Дата создания" (граница между Название и Дата создания)
  created_at: 'due_date',     // Левая грань "Планируемая дата" (граница между Дата создания и Планируемая дата)
  link: 'task_status',        // Левая грань "Статус" (граница между Ссылка и Статус)
  task_status: 'closed_dttm', // Левая грань "Дата завершения" (граница между Статус и Дата завершения)
};

const TaskList: React.FC<Props> = ({
  tasks,
  taskTagsMap,
  onTaskClick,
  onToggleStatus,
  onEditTask,
  onDeleteTask,
}) => {
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [wrapperWidth, setWrapperWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.max(800, window.innerWidth - 64);
    }
    return 1000;
  });

  useEffect(() => {
    const el = tableWrapperRef.current;
    if (!el) return;

    const update = () => {
      if (el.clientWidth > 0) {
        setWrapperWidth(el.clientWidth);
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'task_status', desc: false },
    { id: 'due_date', desc: false },
  ]);

  // Восстановление сохраненных размеров колонок из localStorage
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('taskList_columnWidths_v5');
      if (saved) {
        return { ...DEFAULT_COLUMN_SIZES, ...JSON.parse(saved) };
      }
    } catch {}
    return { ...DEFAULT_COLUMN_SIZES };
  });

  const [isResizingCol, setIsResizingCol] = useState<string | null>(null);

  const nonTitleTotal = useMemo(() => {
    return (
      (columnWidths.created_at ?? 155) +
      (columnWidths.due_date ?? 180) +
      (columnWidths.link ?? 80) +
      (columnWidths.task_status ?? 115) +
      (columnWidths.closed_dttm ?? 175) +
      (columnWidths.actions ?? 115)
    );
  }, [columnWidths]);

  // Заголовок "Название" занимает всё оставшееся место, чтобы таблица всегда занимала ровно 100% ширины
  const titleWidth = useMemo(() => {
    return Math.max(200, wrapperWidth - nonTitleTotal);
  }, [wrapperWidth, nonTitleTotal]);

  const totalTableWidth = titleWidth + nonTitleTotal;

  const getColWidth = useCallback(
    (colId: string): number => {
      if (colId === 'title') return titleWidth;
      return columnWidths[colId] ?? DEFAULT_COLUMN_SIZES[colId] ?? 100;
    },
    [titleWidth, columnWidths]
  );

  const handleResizeStart = useCallback(
    (targetCol: 'created_at' | 'due_date' | 'task_status' | 'closed_dttm', e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const startWidth = columnWidths[targetCol] ?? DEFAULT_COLUMN_SIZES[targetCol];
      const minWidth = COLUMN_MIN_SIZES[targetCol];

      // Ограничение: "Название" не может сжаться меньше 200px
      const currentTitleWidth = Math.max(200, wrapperWidth - nonTitleTotal);
      const maxExpand = Math.max(0, currentTitleWidth - 200);
      const maxWidth = startWidth + maxExpand;

      setIsResizingCol(targetCol);

      const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const deltaX = currentX - startX;
        // Тянем левую границу влево (deltaX < 0) -> целевой столбец расширяется влево,
        // правая граница и все столбцы правее остаются на месте!
        // Тянем вправо (deltaX > 0) -> целевой столбец сжимается (до minWidth).
        let newWidth = Math.round(startWidth - deltaX);
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;

        setColumnWidths((prev) => {
          const next = { ...prev, [targetCol]: newWidth };
          try {
            localStorage.setItem('taskList_columnWidths_v5', JSON.stringify(next));
          } catch {}
          return next;
        });
      };

      const onEnd = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        setIsResizingCol(null);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    },
    [columnWidths, wrapperWidth, nonTitleTotal]
  );

  const data = useMemo<TaskRowData[]>(() => {
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    return tasks.map((task) => {
      const isCompleted = task.task_status === 2;
      let overdue = 0;

      let dueUtc: number | null = null;
      if (task.due_date) {
        const parts = task.due_date.split('-');
        if (parts.length === 3) {
          dueUtc = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
      }

      if (dueUtc !== null && !isCompleted) {
        const diffDays = Math.floor((todayUtc - dueUtc) / (1000 * 60 * 60 * 24));
        overdue = diffDays > 0 ? diffDays : 0;
      }

      let overdueClosed = 0;
      let earlyClosed = 0;
      if (isCompleted && dueUtc !== null && task.closed_dttm) {
        const diff = getCompletionDiff(task.due_date, task.closed_dttm);
        overdueClosed = diff.overdueClosed;
        earlyClosed = diff.earlyClosed;
      }
      return { ...task, isCompleted, overdue, overdueClosed, earlyClosed };
    });
  }, [tasks]);

  const columns = useMemo<ColumnDef<TaskRowData>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Название',
        minSize: 200,
        sortingFn: 'alphanumeric',
        meta: {
          className: 'task-title-td',
        },
        cell: (info) => {
          const task = info.row.original;
          return (
            <div className="task-title-cell" title={task.description || task.title}>
              <span className="task-id-badge">#{task.task_id}</span>
              <span className="task-title-text">{info.getValue() as string}</span>
            </div>
          );
        },
      },
      {
        id: 'created_at',
        accessorFn: (row) => row.created_at ?? undefined,
        header: 'Дата создания',
        size: 155,
        minSize: 155,
        enableResizing: true,
        sortUndefined: 'last',
        sortingFn: 'alphanumeric',
        cell: (info) => {
          const createdAt = info.getValue() as string | undefined;
          const formatted = createdAt ? new Date(createdAt).toLocaleDateString('ru-RU') : '—';
          return (
            <div className="task-created-cell" title={createdAt || 'Нет даты'}>
              {formatted}
            </div>
          );
        },
      },
      {
        id: 'due_date',
        accessorFn: (row) => row.due_date ?? undefined,
        header: 'Планируемая дата',
        size: 180,
        minSize: 180,
        enableResizing: true,
        sortUndefined: 'last',
        sortingFn: 'alphanumeric',
        meta: {
          className: 'task-date-td',
          thClassName: 'task-th-date',
        },
        cell: (info) => {
          const dueDate = info.getValue() as string | undefined;
          const { overdue, overdueClosed, earlyClosed, isCompleted } = info.row.original;
          const formatted = dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('ru-RU') : '—';

          let dueDateState: 'overdue' | 'overdueClosed' | 'earlyClosed' | 'normal' | null = null;
          let tooltipText = '';
          if (overdue > 0 && !isCompleted) {
            dueDateState = 'overdue';
            tooltipText = `Просрочена на ${overdue} дн.`;
          } else if (overdueClosed > 0 && isCompleted) {
            dueDateState = 'overdueClosed';
            tooltipText = `Закрыта с опозданием на ${overdueClosed} дн.`;
          } else if (earlyClosed > 0 && isCompleted) {
            dueDateState = 'earlyClosed';
            tooltipText = `Закрыта с опережением на ${earlyClosed} дн.`;
          }

          return (
            <div className="task-date-cell" title={dueDate || 'Нет даты'}>
              {dueDate ? (
                <div
                  className={`date-badge ${dueDateState === 'overdue' ? 'date-badge-overdue' : ''} ${
                    dueDateState === 'overdueClosed' ? 'date-badge-overdue-closed' : ''
                  } ${dueDateState === 'earlyClosed' ? 'date-badge-early-closed' : ''}`}
                  title={tooltipText || dueDate}
                >
                  {dueDateState === 'overdue' && (
                    <span className="date-badge-icon">
                      <AlertCircle size={14} />
                      {overdue}
                    </span>
                  )}
                  {dueDateState === 'overdueClosed' && (
                    <span className="date-badge-icon date-badge-icon-closed">
                      <Gauge size={14} />
                      {overdueClosed}
                    </span>
                  )}
                  {dueDateState === 'earlyClosed' && (
                    <span className="date-badge-icon date-badge-icon-closed">
                      <Gauge size={14} />
                      {earlyClosed}
                    </span>
                  )}
                  <span className="date-badge-text">{formatted}</span>
                </div>
              ) : (
                <span className="date-placeholder">—</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'link',
        header: 'Ссылка',
        size: 80,
        minSize: 80,
        enableSorting: false,
        enableResizing: false,
        meta: {
          className: 'task-link-td',
          thClassName: 'task-th-link',
        },
        cell: (info) => {
          const link = info.row.original.link_to_taskmanager;
          if (!link) return null;
          const parts = link.split('/').filter(Boolean);
          let lastPartCalc = parts[parts.length - 1] || '';
          if (!/^\d+$/.test(lastPartCalc)) {
            lastPartCalc = '';
          }
          const lastPart = lastPartCalc;
          return (
            <div className="task-link-cell">
              <a
                href={link.startsWith('http') ? link : `https://${link}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Открыть во внешнем менеджере"
              >
                <ExternalLink size={16} />
                {lastPart && <small>{lastPart}</small>}
              </a>
            </div>
          );
        },
      },
      {
        accessorKey: 'task_status',
        header: 'Статус',
        size: 115,
        minSize: 115,
        enableResizing: true,
        sortingFn: 'basic',
        meta: {
          className: 'task-status-td',
          thClassName: 'task-th-status',
        },
        cell: (info) => {
          const task = info.row.original;
          const isCompleted = task.isCompleted;
          const tags = taskTagsMap.get(task.task_id) || [];
          return (
            <div className="task-status-cell">
              {tags.length > 0 && (
                <div className="task-status-tags">
                  {tags.map((tag) => (
                    <span
                      key={tag.task_tag_id}
                      className="task-status-tag-dot"
                      title={tag.tag_text}
                      style={{ backgroundColor: tag.tag_color }}
                    />
                  ))}
                </div>
              )}
              <span className={`task-status-label ${isCompleted ? 'status-label-completed' : 'status-label-active'}`}>
                {isCompleted ? 'Выполнена' : 'Активна'}
              </span>
            </div>
          );
        },
      },
      {
        id: 'closed_dttm',
        accessorFn: (row) => row.closed_dttm ?? undefined,
        header: 'Дата завершения',
        size: 175,
        minSize: 175,
        enableResizing: true,
        sortUndefined: 'last',
        sortingFn: 'alphanumeric',
        cell: (info) => {
          const closedDttm = info.getValue() as string | undefined;
          const formatted = closedDttm ? new Date(closedDttm).toLocaleDateString('ru-RU') : '—';
          return (
            <div className="task-closed-cell" title={closedDttm || 'Нет даты завершения'}>
              {formatted}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 115,
        minSize: 115,
        enableSorting: false,
        enableResizing: false,
        cell: (info) => {
          const task = info.row.original;
          const isCompleted = task.isCompleted;
          return (
            <div className="task-actions-group">
              <button
                className="status-toggle-btn-list"
                onClick={(e) => {
                  e.stopPropagation();
                  const newStatus = isCompleted ? 1 : 2;
                  onToggleStatus(task.task_id, newStatus);
                }}
                title={isCompleted ? 'Отметить как невыполненную' : 'Отметить как выполненную'}
              >
                <CheckCircle2
                  size={18}
                  className={isCompleted ? 'status-icon completed' : 'status-icon incomplete'}
                />
              </button>
              <button
                className="edit-btn-list"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTask(task);
                }}
                title="Редактировать задачу"
              >
                <Edit size={16} />
              </button>
              <button
                className="delete-btn-list"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask(task);
                }}
                title="Удалить задачу"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        },
      },
    ],
    [taskTagsMap, onToggleStatus, onEditTask, onDeleteTask]
  );

  // Глобальный фильтр: поиск по всем полям задачи + поиск по id с # и без него
  const globalFilterFn = useCallback(
    (row: any, _columnId: string, filterValue: string) => {
      const search = (filterValue ?? '').trim().toLowerCase();
      if (!search) return true;

      const task = row.original as TaskRowData;
      const taskIdStr = String(task.task_id ?? '');
      const taskIdHash = `#${taskIdStr}`;
      const searchWithoutHash = search.replace(/^#\s*/, '');

      // 1. Поиск по номеру ID (с # и без #)
      if (searchWithoutHash && taskIdStr.includes(searchWithoutHash)) {
        return true;
      }
      if (taskIdHash.toLowerCase().includes(search)) {
        return true;
      }

      // 2. Теги задачи
      const tags = taskTagsMap.get(task.task_id) || [];
      if (tags.some((t) => t.tag_text.toLowerCase().includes(search))) {
        return true;
      }

      // 3. Текстовые поля задачи
      const fields = [
        task.title ?? '',
        task.description ?? '',
        task.link_to_taskmanager ?? '',
        task.due_date ?? '',
        task.closed_dttm ?? '',
        task.task_status != null ? String(task.task_status) : '',
        task.task_status === 2 ? 'выполнена' : 'активна',
        String(task.task_priority_id ?? ''),
      ];

      return fields.some((f) => String(f).toLowerCase().includes(search));
    },
    [taskTagsMap]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    enableMultiSort: true,
    enableSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn,
  });

  const rowCount = table.getRowModel().rows.length;
  const totalCount = tasks.length;

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <div className="task-list-title-wrap">
          <h3 title="Shift + Left click - мультисортировка">📋 Список задач</h3>
          <span className="task-list-count-badge">
            {globalFilter ? `${rowCount} из ${totalCount}` : totalCount}
          </span>
        </div>
        <div className="task-list-search">
          <Search size={16} className="task-list-search-icon" />
          <input
            type="text"
            placeholder="Поиск по всем полям..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          {globalFilter && (
            <button
              type="button"
              className="task-list-search-clear"
              onClick={() => setGlobalFilter('')}
              title="Очистить поиск"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="task-list-table-wrapper" ref={tableWrapperRef}>
        <table
          className="task-list-table"
          style={{
            width: totalTableWidth > wrapperWidth ? `${totalTableWidth}px` : '100%',
            minWidth: '100%',
          }}
        >
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col
                key={column.id}
                style={{
                  width: `${getColWidth(column.id)}px`,
                }}
              />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta as { thClassName?: string } | undefined;
                  const resizableTarget = RESIZABLE_DIVIDERS[header.column.id];

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: `${getColWidth(header.column.id)}px` }}
                      className={`task-th ${canSort ? 'sortable' : ''} ${meta?.thClassName || ''}`}
                    >
                      <div
                        className="th-content"
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        title={canSort ? 'Нажмите для сортировки (Shift+клик для мультисортировки)' : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="sort-indicator">
                            {{
                              asc: ' ↑',
                              desc: ' ↓',
                            }[isSorted as string] ?? ' ↕'}
                          </span>
                        )}
                      </div>
                      {resizableTarget && (
                        <div
                          onMouseDown={(e) => handleResizeStart(resizableTarget, e)}
                          onTouchStart={(e) => handleResizeStart(resizableTarget, e)}
                          onClick={(e) => e.stopPropagation()}
                          className={`resizer ${isResizingCol === resizableTarget ? 'isResizing' : ''}`}
                          title="Потяните для изменения размера (левая граница столбца)"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rowCount === 0 ? (
              <tr>
                <td colSpan={columns.length} className="no-tasks">
                  Задачи не найдены
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`task-row ${row.original.isCompleted ? 'completed-row' : ''}`}
                  onClick={() => onTaskClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={meta?.className || ''}
                        style={{ width: `${getColWidth(cell.column.id)}px` }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskList;
