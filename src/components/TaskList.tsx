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

  // Восстановление сохраненных размеров колонок из localStorage (кроме эластичного столбца "title")
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('taskList_columnSizing_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed.title;
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  });

  const handleColumnSizingChange = useCallback(
    (updater: any) => {
      setColumnSizing((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next && next.title) {
          delete next.title;
        }
        try {
          localStorage.setItem('taskList_columnSizing_v3', JSON.stringify(next));
        } catch (e) {
          console.error('Failed to save column sizing', e);
        }
        return next;
      });
    },
    []
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
        size: 250,
        minSize: 180,
        enableResizing: false,
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
        size: 115,
        minSize: 95,
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
        size: 135,
        minSize: 105,
        sortUndefined: 'last',
        sortingFn: 'alphanumeric',
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
        size: 60,
        minSize: 50,
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
        size: 125,
        minSize: 100,
        sortingFn: 'basic',
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
        size: 135,
        minSize: 105,
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
        size: 105,
        minSize: 90,
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
      columnSizing,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: handleColumnSizingChange,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
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
            width: table.getTotalSize() > wrapperWidth ? `${table.getTotalSize()}px` : '100%',
            minWidth: '100%',
          }}
        >
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col
                key={column.id}
                style={{
                  width: column.id === 'title' ? 'auto' : `${column.getSize()}px`,
                }}
              />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const canResize = header.column.getCanResize();
                  const isSorted = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta as { thClassName?: string } | undefined;

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{ width: header.column.id === 'title' ? undefined : `${header.getSize()}px` }}
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
                      {canResize && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            header.getResizeHandler()(e);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            header.getResizeHandler()(e);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                          title="Потяните для изменения размера"
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
                        style={{ width: cell.column.id === 'title' ? undefined : `${cell.column.getSize()}px` }}
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
