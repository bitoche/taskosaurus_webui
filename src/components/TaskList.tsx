import React, { useMemo, useState } from 'react';
import { Task, TaskTag } from '../types';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnResizeMode,
  ColumnDef,
  SortingState,
  flexRender,
} from '@tanstack/react-table';
import { CheckCircle2, AlertCircle, Search, Edit, Trash2, ExternalLink } from 'lucide-react';
import './TaskList.css';

interface Props {
  tasks: Task[];
  taskTagsMap: Map<number, TaskTag[]>;
  onTaskClick: (task: Task) => void;
  onToggleStatus: (taskId: number, newStatus: number) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

// Глобальный фильтр по всем полям таски
function globalFilterFn(row: any, _columnId: string, filterValue: string) {
  const search = filterValue.toLowerCase();
  if (!search) return true;
  const task = row.original as any;
  const fields = [
    String(task.task_id ?? ''),
    task.title ?? '',
    task.description ?? '',
    task.link_to_taskmanager ?? '',
    task.due_date ?? '',
    task.closed_dttm ?? '',
    task.task_status != null ? String(task.task_status) : '',
    String(task.task_priority_id ?? ''),
  ];
  return fields.some(f => f.toLowerCase().includes(search));
}

const TaskList: React.FC<Props> = ({ tasks, taskTagsMap, onTaskClick, onToggleStatus, onEditTask, onDeleteTask }) => {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'task_status', desc: false },
    { id: 'due_date', desc: false },
  ]);
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  const data = useMemo(() => {
    const now = new Date();
    // Текущий календарный день в UTC
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    return tasks.map(task => {
      const isCompleted = task.task_status === 2;
      let overdue = 0;

      // Парсинг due_date (YYYY-MM-DD) в полночь UTC
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

      // Просрочка при закрытии: задача завершена, closed_dttm заполнено
      let overdueClosed = 0;
      if (isCompleted && dueUtc !== null && task.closed_dttm) {
        const closedStr = task.closed_dttm.endsWith('Z') || task.closed_dttm.includes('+')
          ? task.closed_dttm
          : task.closed_dttm + 'Z';
        const closedDate = new Date(closedStr);
        const closedUtc = Date.UTC(
          closedDate.getUTCFullYear(),
          closedDate.getUTCMonth(),
          closedDate.getUTCDate()
        );
        const diffDays = Math.floor((closedUtc - dueUtc) / (1000 * 60 * 60 * 24));
        overdueClosed = diffDays > 0 ? diffDays : 0;
      }
      return { ...task, isCompleted, overdue, overdueClosed };
    });
  }, [tasks]);

  const columns = useMemo<ColumnDef<Task & { isCompleted: boolean; overdue: number; overdueClosed: number }>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Название',
        size: 300,
        minSize: 150,
        meta: {
          className: 'task-title-td',
        },
        cell: info => (
          <div className="task-title-cell" title={info.row.original.description || 'Нет описания'}>
            <div className="task-id-place">#{info.row.original.task_id}</div> {info.getValue() as string}
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Дата создания',
        size: 120,
        minSize: 100,
        cell: info => {
          const createdAt = info.getValue() as string | null;
          const formatted = createdAt ? new Date(createdAt).toLocaleDateString('ru-RU') : '—';
          return (
            <div className="task-created-cell" title={createdAt || 'Нет даты'}>
              {formatted}
            </div>
          );
        },
      },
      {
        accessorKey: 'due_date',
        header: 'Планируемая дата',
        size: 150,
        minSize: 100,
        cell: info => {
          const dueDate = info.getValue() as string | null;
          const overdue = info.row.original.overdue;
          const overdueClosed = info.row.original.overdueClosed;
          const isCompleted = info.row.original.isCompleted;
          const formatted = dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('ru-RU') : '—';

          // Определяем состояние даты
          let dueDateState: 'overdue' | 'overdueClosed' | 'normal' | null = null;
          let tooltipText = '';
          if (overdue > 0 && !isCompleted) {
            dueDateState = 'overdue';
            tooltipText = `Просрочена на ${overdue} дн.`;
          } else if (overdueClosed > 0 && isCompleted) {
            dueDateState = 'overdueClosed';
            tooltipText = `Закрыта с опозданием на ${overdueClosed} дн.`;
          }

          return (
            <div
              className="task-date-cell"
              title={dueDate || 'Нет даты'}
            >
              {dueDate ? (
                <div
                  className={`date-badge ${dueDateState === 'overdue' ? 'date-badge-overdue' : ''} ${dueDateState === 'overdueClosed' ? 'date-badge-overdue-closed' : ''}`}
                  title={tooltipText || dueDate}
                >
                  {dueDateState === 'overdue' && (
                    <span className="date-badge-icon">
                      <AlertCircle size={14} />{overdue}
                    </span>
                  )}
                  {dueDateState === 'overdueClosed' && (
                    <span className="date-badge-icon date-badge-icon-closed">
                      <AlertCircle size={14} />{overdueClosed}
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
        enableSorting: false,
        enableResizing: false,
        cell: info => {
          const link = info.row.original.link_to_taskmanager;
          if (!link) return null;
          const parts = link.split('/').filter(Boolean);
          let lastPartCalc = parts[parts.length - 1] || '';
          if ( /^\d+$/.test(lastPartCalc) ) {} else {lastPartCalc = ''} // убираем подпись, если не получилось число
          const lastPart = lastPartCalc
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
        size: 180,
        cell: info => {
          const task = info.row.original as Task & { isCompleted: boolean };
          const isCompleted = task.isCompleted;
          const tags = taskTagsMap.get(task.task_id) || [];
          return (
            <div className="task-status-cell" title={info.row.original.description || 'Нет описания'}>
              {tags.length > 0 && (
                  <div className="task-status-tags">
                    {tags.map(tag => (
                      <span
                        key={tag.task_tag_id}
                        className="task-status-tag-dot"
                        title={tag.tag_text}
                        style={{ backgroundColor: tag.tag_color }}
                      />
                    ))}
                  </div>
                )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {isCompleted ? 'Выполнена' : 'Активна'}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'closed_dttm',
        header: 'Дата завершения',
        size: 150,
        minSize: 100,
        cell: info => {
          const closedDttm = info.getValue() as string | null;
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
        size: 120,
        enableSorting: false,
        enableResizing: false,
        cell: info => {
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
    [onToggleStatus, onEditTask, onDeleteTask]
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
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode,
    enableMultiSort: true,
    enableSorting: true,
    globalFilterFn,
  });

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <h3 title="Shift + Left click - мультисортировка">📋 Список задач</h3>
        <div className="task-list-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск по всем полям..."
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="task-list-table-wrapper">
        <table className="task-list-table" style={{ width: table.getTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ width: header.getSize(), position: 'relative' }}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    className={header.column.getCanSort() ? 'sortable' : ''}
                  >
                    <div className="th-content">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="sort-indicator">
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? ' ↕'}
                        </span>
                      )}
                    </div>
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="no-tasks">Задачи не найдены</td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={`task-row ${row.original.isCompleted ? 'completed-row' : ''}`}
                  onClick={() => onTaskClick(row.original)}
                >
                  {row.getVisibleCells().map(cell => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={meta?.className || ''}
                        style={{ width: cell.column.getSize() }}
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