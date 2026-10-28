import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Inbox, CheckCircle2, ExternalLink } from 'lucide-react';
import { Task, TaskTag, TaskPriority } from '../types';
import TaskTags from './TaskTags';

interface UndatedTasksPanelProps {
  tasks: Task[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onMoveTask: (taskId: number, newDueDate: string) => void;
  onToggleStatus: (taskId: number, currentStatus: number) => void;
  onRemoveTagFromTask?: (taskId: number, tagId: number) => void;
  taskTagsMap?: Map<number, TaskTag[]>;
  allPriorities?: TaskPriority[];
}

export const UndatedTasksPanel: React.FC<UndatedTasksPanelProps> = ({
  tasks,
  isOpen,
  onToggleOpen,
  onAddTask,
  onEditTask,
  onMoveTask,
  onToggleStatus,
  onRemoveTagFromTask,
  taskTagsMap,
  allPriorities,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const priorityMap = new Map<number, TaskPriority>();
  const priorityWeightMap = new Map<number, number>();
  if (allPriorities) {
    for (const p of allPriorities) {
      priorityMap.set(p.priority_id, p);
      priorityWeightMap.set(p.priority_id, p.priority_sorting_weight);
    }
  }

  // Filter tasks that have no due_date
  const undatedTasks = tasks.filter(t => !t.due_date);

  // Sort tasks: incomplete first, then by priority weight, then by task_id
  const sortedTasks = [...undatedTasks].sort((a, b) => {
    const aComp = a.task_status === 2 ? 1 : 0;
    const bComp = b.task_status === 2 ? 1 : 0;
    if (aComp !== bComp) return aComp - bComp;

    const wA = a.task_priority_id != null ? (priorityWeightMap.get(a.task_priority_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    const wB = b.task_priority_id != null ? (priorityWeightMap.get(b.task_priority_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    if (wA !== wB) return wA - wB;
    return (a.task_id ?? 0) - (b.task_id ?? 0);
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskIdStr = e.dataTransfer.getData('text/plain');
    const taskId = parseInt(taskIdStr, 10);
    if (!isNaN(taskId)) {
      onMoveTask(taskId, '');
    }
  };

  const handleOpenLink = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (url) {
      window.open('https://' + url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`undated-section-wrapper ${isDragOver ? 'undated-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="undated-section-toggle-bar">
        <button
          type="button"
          className="undated-section-toggle-btn"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          title={isOpen ? 'Скрыть задачи без даты' : 'Показать задачи без даты'}
        >
          <div className="undated-toggle-left">
            <Inbox size={18} className="undated-toggle-icon" />
            <span className="undated-toggle-title">Задачи без даты</span>
            <span className="undated-count-badge">{undatedTasks.length}</span>
          </div>
          <div className="undated-toggle-right">
            <span className="undated-toggle-hint">
              {isOpen ? 'Скрыть' : 'Показать'}
            </span>
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="undated-section-content">
          <div className="undated-section-header">
            <div className="undated-section-desc">
              Перетаскивайте задачи в календарь на нужный день или обратно
            </div>
            <button
              type="button"
              className="undated-add-btn"
              onClick={onAddTask}
              title="Создать задачу без даты"
            >
              <Plus size={16} />
              <span>+ Добавить задачу без даты</span>
            </button>
          </div>

          {sortedTasks.length === 0 ? (
            <div className="undated-empty-state">
              <Inbox size={24} className="undated-empty-icon" />
              <span>Все задачи распределены по датам. Перетащите задачу сюда, чтобы снять дату.</span>
            </div>
          ) : (
            <div className="undated-tasks-grid">
              {sortedTasks.map(task => {
                const isCompleted = task.task_status === 2;
                const hasLink = task.link_to_taskmanager && task.link_to_taskmanager.trim() !== '';
                const taskTags = taskTagsMap?.get(task.task_id) || [];
                const priority = task.task_priority_id != null ? priorityMap.get(task.task_priority_id) : null;
                const priorityColor = priority?.priority_color;

                return (
                  <div
                    key={task.task_id}
                    className={`task-item undated-task-card ${isCompleted ? 'completed-task' : ''}`}
                    style={priorityColor ? { borderLeft: `4px solid ${priorityColor}` } : undefined}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', task.task_id.toString());
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      onEditTask(task);
                    }}
                  >
                    <div className="task-title">
                      <span className="task-title-text" title={task.title}>{task.title}</span>
                      <div className="task-actions">
                        <button
                          type="button"
                          className="status-toggle-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newStatus = task.task_status === 2 ? 1 : 2;
                            onToggleStatus(task.task_id, newStatus);
                          }}
                          title={isCompleted ? "Отметить как невыполненную" : "Отметить как выполненную"}
                        >
                          <CheckCircle2
                            size={18}
                            className={isCompleted ? "status-icon completed" : "status-icon incomplete"}
                          />
                        </button>
                        {hasLink && (
                          <button
                            type="button"
                            className="link-btn"
                            onClick={(e) => handleOpenLink(e, task.link_to_taskmanager!)}
                            title="Открыть во внешнем менеджере"
                          >
                            <ExternalLink size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    {taskTags.length > 0 && (
                      <TaskTags
                        tags={taskTags}
                        onRemove={onRemoveTagFromTask ? (tagId) => onRemoveTagFromTask(task.task_id, tagId) : undefined}
                        maxVisible={5}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UndatedTasksPanel;
