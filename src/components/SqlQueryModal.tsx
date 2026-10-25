import React, { useState, useEffect, useRef, useCallback } from 'react';
import { executeTaskQuery } from '../api';
import { SqlQueryResult } from '../types';
import {
  Database,
  Play,
  RotateCcw,
  Copy,
  Download,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Code2
} from 'lucide-react';
import './SqlQueryModal.css';

interface SqlQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask?: (taskId: number) => void;
}

interface QueryPreset {
  name: string;
  query: string;
  description: string;
}

const PRESETS: QueryPreset[] = [
  {
    name: 'Все активные задачи',
    query: 'SELECT * FROM task WHERE task_status = 1 ORDER BY due_date ASC',
    description: 'Активные (незавершенные) задачи, отсортированные по сроку выполнения'
  },
  {
    name: 'Задачи с приоритетами',
    query: 'SELECT t.task_id, t.title, t.due_date, p.priority_name, p.priority_color FROM task t LEFT JOIN task_priority p ON t.task_priority_id = p.priority_id',
    description: 'Список задач с названиями и цветами приоритетов'
  },
  {
    name: 'Задачи по тегам',
    query: 'SELECT t.task_id, t.title, tg.tag_text, tg.tag_color FROM task t JOIN task_tag_x_task xt ON t.task_id = xt.task_id JOIN task_tag tg ON xt.task_tag_id = tg.task_tag_id',
    description: 'Задачи, сгруппированные по присвоенным тегам'
  },
  {
    name: 'Просроченные задачи',
    query: 'SELECT task_id, title, due_date FROM task WHERE task_status = 1 AND due_date < CURRENT_DATE',
    description: 'Активные задачи, срок выполнения которых уже наступил'
  }
];

const SCHEMA_INFO: { table: string; description: string; columns: string[] }[] = [
  {
    table: 'task',
    description: 'Основные задачи',
    columns: ['task_id', 'title', 'description', 'link_to_taskmanager', 'due_date', 'closed_dttm', 'created_at', 'task_status', 'task_priority_id']
  },
  {
    table: 'task_priority',
    description: 'Приоритеты задач',
    columns: ['priority_id', 'priority_name', 'priority_color', 'priority_sorting_weight']
  },
  {
    table: 'task_tag',
    description: 'Теги / категории',
    columns: ['task_tag_id', 'tag_text', 'tag_color']
  },
  {
    table: 'task_tag_x_task',
    description: 'Связка задач и тегов',
    columns: ['task_tag_id', 'task_id']
  },
  {
    table: 'task_comment',
    description: 'Комментарии к задачам',
    columns: ['comment_id', 'task_id', 'text', 'created_at']
  },
  {
    table: 'task_status',
    description: 'Справочник статусов (1 = Активна, 2 = Завершена)',
    columns: ['status_id', 'status_name']
  }
];

const SqlQueryModal: React.FC<SqlQueryModalProps> = ({ isOpen, onClose, onSelectTask }) => {
  const [query, setQuery] = useState<string>(PRESETS[0].query);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showSchema, setShowSchema] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const validateQuery = (sql: string): string | null => {
    const trimmed = sql.trim();
    if (!trimmed) {
      return 'Запрос не может быть пустым';
    }
    const cleanSql = trimmed.replace(/^(\s*--[^\n]*\n|\s*\/\*[\s\S]*?\*\/)*/g, '').trim();
    if (!/^SELECT\b/i.test(cleanSql)) {
      return 'Разрешены только SELECT-запросы для безопасного чтения данных';
    }
    // Check forbidden destructive statements
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|ATTACH|DETACH)\b/i;
    if (forbidden.test(cleanSql)) {
      return 'Деструктивные или модифицирующие команды (INSERT, UPDATE, DELETE и др.) запрещены';
    }
    return null;
  };

  const handleExecute = useCallback(async () => {
    const vErr = validateQuery(query);
    if (vErr) {
      setValidationError(vErr);
      setError(null);
      return;
    }

    setValidationError(null);
    setError(null);
    setLoading(true);

    try {
      const res = await executeTaskQuery(query.trim());
      setResult(res);
    } catch (err: any) {
      console.error('SQL query execution failed:', err);
      setError(err?.message || 'Ошибка выполнения SQL-запроса');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDownInEditor = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  const handleInsertText = (text: string) => {
    if (!textareaRef.current) {
      setQuery(prev => prev + ' ' + text);
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextVal = query.substring(0, start) + text + query.substring(end);
    setQuery(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const handleCopyJson = () => {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (!result || !result.columns.length) return;
    const { columns, rows } = result;

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = columns.map(escapeCsv).join(',');
    const rowLines = rows.map(row => columns.map(col => escapeCsv(row[col])).join(','));
    const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tasks_query_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const hasTaskIdColumn = result?.columns.some(c => c.toLowerCase() === 'task_id');

  return (
    <div className="sql-modal-overlay" onClick={onClose}>
      <div className="sql-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sql-modal-header">
          <div className="sql-modal-title">
            <Database className="sql-modal-icon" size={24} />
            <div>
              <h2>SQL-запрос к базе задач</h2>
              <span className="sql-modal-subtitle">
                Выполнение аналитических SELECT-запросов напрямую к базе данных
              </span>
            </div>
          </div>
          <button className="sql-modal-close-btn" onClick={onClose} title="Закрыть (Esc)">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="sql-modal-body">
          {/* Presets */}
          <div className="sql-presets-section">
            <span className="sql-section-label">Быстрые шаблоны:</span>
            <div className="sql-presets-list">
              {PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  className={`sql-preset-btn ${query === preset.query ? 'active' : ''}`}
                  onClick={() => {
                    setQuery(preset.query);
                    setValidationError(null);
                    setError(null);
                  }}
                  title={preset.description}
                >
                  <Code2 size={14} />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Schema hints toggle */}
          <div className="sql-schema-toggle-row">
            <button
              className="sql-schema-toggle-btn"
              onClick={() => setShowSchema(!showSchema)}
              type="button"
            >
              {showSchema ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <HelpCircle size={16} />
              <span>Справка по структуре таблиц и колонок</span>
            </button>
          </div>

          {showSchema && (
            <div className="sql-schema-container">
              {SCHEMA_INFO.map(s => (
                <div key={s.table} className="sql-schema-card">
                  <div className="sql-schema-card-header">
                    <span
                      className="sql-schema-table-name clickable"
                      onClick={() => handleInsertText(s.table)}
                      title="Кликните, чтобы вставить таблицу в запрос"
                    >
                      {s.table}
                    </span>
                    <span className="sql-schema-table-desc">{s.description}</span>
                  </div>
                  <div className="sql-schema-cols">
                    {s.columns.map(col => (
                      <span
                        key={col}
                        className="sql-schema-col-pill clickable"
                        onClick={() => handleInsertText(col.split(' ')[0])}
                        title="Кликните, чтобы вставить колонку"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Editor */}
          <div className="sql-editor-container">
            <div className="sql-editor-header">
              <span className="sql-editor-label">SQL-запрос (Ctrl+Enter для запуска):</span>
              <button
                className="sql-editor-clear-btn"
                onClick={() => {
                  setQuery('');
                  textareaRef.current?.focus();
                }}
                title="Очистить редактор"
              >
                <RotateCcw size={14} /> Очистить
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className="sql-editor-textarea"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onKeyDown={handleKeyDownInEditor}
              placeholder="Введите SELECT-запрос (например, SELECT task_id, title FROM task WHERE task_status = 1)..."
              rows={5}
              spellCheck={false}
            />
          </div>

          {/* Action Row */}
          <div className="sql-action-row">
            <button
              className="sql-run-btn"
              onClick={handleExecute}
              disabled={loading || !query.trim()}
              title="Выполнить запрос (Ctrl+Enter)"
            >
              <Play size={16} fill="currentColor" />
              <span>{loading ? 'Выполнение...' : 'Выполнить запрос'}</span>
            </button>
            <span className="sql-shortcut-hint">или нажмите <kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>
          </div>

          {/* Validation & Error Alerts */}
          {validationError && (
            <div className="sql-alert sql-alert-warning">
              <AlertCircle size={18} />
              <span>{validationError}</span>
            </div>
          )}

          {error && (
            <div className="sql-alert sql-alert-error">
              <AlertCircle size={18} />
              <div className="sql-alert-content">
                <strong>Ошибка выполнения:</strong>
                <pre>{error}</pre>
              </div>
            </div>
          )}

          {/* Results section */}
          {result && (
            <div className="sql-results-section">
              <div className="sql-results-toolbar">
                <div className="sql-results-count">
                  Найдено записей: <strong>{result.count}</strong>
                  {result.has_more && (
                    <span className="sql-has-more-badge" style={{ marginLeft: 8, color: '#f59e0b', fontSize: '0.85em' }}>
                      (показаны первые {result.count} строк, лимит выборки)
                    </span>
                  )}
                  {hasTaskIdColumn && (
                    <span className="sql-clickable-hint">
                      (кликните по строке с <code>task_id</code> для открытия задачи)
                    </span>
                  )}
                </div>
                <div className="sql-results-actions">
                  <button
                    className="sql-secondary-btn"
                    onClick={handleCopyJson}
                    title="Скопировать результат в формате JSON"
                  >
                    {isCopied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                    <span>{isCopied ? 'Скопировано!' : 'Копировать JSON'}</span>
                  </button>
                  <button
                    className="sql-secondary-btn"
                    onClick={handleExportCsv}
                    title="Экспортировать результат в CSV-файл"
                  >
                    <Download size={16} />
                    <span>Экспорт в CSV</span>
                  </button>
                </div>
              </div>

              {result.rows.length === 0 ? (
                <div className="sql-no-results">
                  Запрос выполнен успешно, но вернул 0 строк.
                </div>
              ) : (
                <div className="sql-table-wrapper">
                  <table className="sql-results-table">
                    <thead>
                      <tr>
                        <th className="sql-th-index">#</th>
                        {result.columns.map(col => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, rowIdx) => {
                        const taskId = row.task_id ?? row.TASK_ID;
                        const isClickable = taskId !== undefined && taskId !== null && onSelectTask;

                        return (
                          <tr
                            key={rowIdx}
                            className={isClickable ? 'sql-tr-clickable' : ''}
                            onClick={() => {
                              if (isClickable && typeof taskId === 'number') {
                                onSelectTask(taskId);
                              }
                            }}
                            title={isClickable ? `Открыть задачу #${taskId}` : undefined}
                          >
                            <td className="sql-td-index">{rowIdx + 1}</td>
                            {result.columns.map(col => {
                              const val = row[col];
                              const isTaskIdCol = col.toLowerCase() === 'task_id';

                              let content: React.ReactNode;
                              if (val === null || val === undefined) {
                                content = <span className="sql-val-null">NULL</span>;
                              } else if (typeof val === 'boolean') {
                                content = <span className="sql-val-bool">{String(val)}</span>;
                              } else if (typeof val === 'object') {
                                content = <code>{JSON.stringify(val)}</code>;
                              } else if (
                                (col.includes('color') || col.endsWith('_color')) &&
                                typeof val === 'string' &&
                                val.startsWith('#')
                              ) {
                                content = (
                                  <span className="sql-color-preview">
                                    <span
                                      className="sql-color-badge"
                                      style={{ backgroundColor: val }}
                                    />
                                    {val}
                                  </span>
                                );
                              } else if (isTaskIdCol && isClickable) {
                                content = (
                                  <span className="sql-task-id-badge">
                                    {val} <ExternalLink size={12} />
                                  </span>
                                );
                              } else {
                                content = String(val);
                              }

                              return <td key={col}>{content}</td>;
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlQueryModal;
