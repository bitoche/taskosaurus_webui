import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task, TaskComment, TaskTag, TaskPriority } from '../types';
import { fetchTaskComments, addTaskComment, deleteTaskComment } from '../api';
import { X, Send, Trash2, Plus, Tag, MessageSquare, FileText, ExternalLink, Calendar, Check, Clock, ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { MarkdownEditor, renderMarkdown } from './MarkdownEditor';
import './TaskModal.css';

interface Props {
  isOpen: boolean;
  task?: Task;
  defaultDate?: string;
  onSave: (taskData: Omit<Task, 'task_id'>) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  allTags: TaskTag[];
  taskTags: TaskTag[];
  onAssignTag: (tagId: number) => void;
  onRemoveTag: (tagId: number) => void;
  onCreateTag: (tagText: string, tagColor: string) => Promise<void>;
  allPriorities?: TaskPriority[];
}

const TaskModal: React.FC<Props> = ({
  isOpen, task, defaultDate, onSave, onDelete, onClose,
  allTags, taskTags, onAssignTag, onRemoveTag, onCreateTag, allPriorities
}) => {
  // Основные поля
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [link, setLink] = useState('');
  const [closedDate, setClosedDate] = useState('');
  const [taskPriorityId, setTaskPriorityId] = useState<number | null>(null);

  // Состояние для раскрытия дополнительных полей
  const [showMore, setShowMore] = useState(false);

  // Комментарии
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Теги
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('#ff0000');
  const [creatingTag, setCreatingTag] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const tagSelectorRef = useRef<HTMLDivElement>(null);

  // === Отслеживание изменений формы (пункт 3.2) ===
  const originalDataRef = useRef<{ title: string; description: string; dueDate: string; link: string; closedDate: string } | null>(null);
  const hasModalChangesRef = useRef(false);

  // Загрузка комментариев при открытии для существующей задачи
  useEffect(() => {
    if (isOpen && task) {
      fetchTaskComments(task.task_id).then(setComments).catch(console.error);
    }
  }, [isOpen, task]);

  // Заполнение формы при редактировании или создании + сохранение оригинальных данных
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
      setLink(task.link_to_taskmanager || '');
      setTaskPriorityId(task.task_priority_id ?? null);
      // closed_dttm: преобразуем ISO в datetime-local формат
      if (task.closed_dttm) {
        const dt = new Date(task.closed_dttm);
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        const hours = String(dt.getHours()).padStart(2, '0');
        const minutes = String(dt.getMinutes()).padStart(2, '0');
        setClosedDate(`${year}-${month}-${day}T${hours}:${minutes}`);
        // Автоматически раскрыть секцию, если есть дата закрытия
        setShowMore(true);
      } else {
        setClosedDate('');
      }
      originalDataRef.current = {
        title: task.title,
        description: task.description || '',
        dueDate: task.due_date ? task.due_date.slice(0, 10) : '',
        link: task.link_to_taskmanager || '',
        closedDate: task.closed_dttm ? task.closed_dttm.slice(0, 16) : '',
      };
    } else {
      setTitle('');
      setDescription('');
      setDueDate(defaultDate || '');
      setLink('');
      setClosedDate('');
      setTaskPriorityId(null);
      setShowMore(false);
      originalDataRef.current = { title: '', description: '', dueDate: defaultDate || '', link: '', closedDate: '' };
    }
  }, [task, defaultDate]);

  // Проверка изменений формы
  useEffect(() => {
    if (originalDataRef.current === null) return;
    const orig = originalDataRef.current;
    const changed = (
      title !== orig.title ||
      description !== orig.description ||
      dueDate !== orig.dueDate ||
      link !== orig.link ||
      closedDate !== orig.closedDate ||
      taskPriorityId !== (task?.task_priority_id ?? null)
    );
    hasModalChangesRef.current = changed;
  }, [title, description, dueDate, link, closedDate, taskPriorityId, task]);

  // Закрытие селектора тегов при клике вне его области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setShowTagSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // === Функция подтверждения закрытия (пункт 3.2) ===
  const handleConfirmClose = useCallback(() => {
    if (hasModalChangesRef.current) {
      const confirmed = window.confirm('Есть несохранённые изменения. Закрыть без сохранения?');
      if (!confirmed) return;
    }
    onClose();
  }, [onClose]);

  // ESC для закрытия модалки
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleConfirmClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleConfirmClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Введите название задачи');
      return;
    }
    await onSave({
      title: title.trim(),
      description: description.trim() || null,
      link_to_taskmanager: link.trim() || null,
      due_date: dueDate || null,
      task_status: task?.task_status ?? null,
      closed_dttm: closedDate || null,
      task_priority_id: taskPriorityId,
    });
    onClose();
  };

  const handleAddComment = async () => {
    if (!task || !newCommentText.trim()) return;
    setAddingComment(true);
    try {
      await addTaskComment(task.task_id, newCommentText.trim());
      const updated = await fetchTaskComments(task.task_id);
      setComments(updated);
      setNewCommentText('');
    } catch (err) {
      console.error(err);
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (window.confirm('Удалить комментарий?')) {
      try {
        await deleteTaskComment(commentId);
        if (task) setComments(await fetchTaskComments(task.task_id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreateTag = async () => {
    const text = newTagText.trim();
    if (text.length < 2 || text.length > 29) return;
    setCreatingTag(true);
    try {
      await onCreateTag(text, newTagColor);
      setNewTagText('');
      setNewTagColor('#4a90d9');
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingTag(false);
    }
  };

  const cancelCreateTag = () => {
    setNewTagText('');
    setNewTagColor('#4a90d9');
  };

  // ==================== Вспомогательный компонент формы тега ====================
  const TagForm: React.FC<{
    value: string;
    onChange: (v: string) => void;
    color: string;
    onColorChange: (v: string) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
  }> = ({ value, onChange, color, onColorChange, onSave, onCancel, saving }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { inputRef.current?.focus(); }, []);
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !saving) onSave();
      if (e.key === 'Escape') onCancel();
    };
    return (
      <div className="tag-editor-form">
        <input
          ref={inputRef}
          type="text"
          placeholder="Название тега"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 29))}
          onKeyDown={handleKeyDown}
          maxLength={29}
        />
        <label className="tag-color-input" title="Цвет">
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
          />
          <span className="tag-color-swatch" style={{ backgroundColor: color }} />
        </label>
        <button
          className="tag-editor-btn tag-editor-btn-save"
          onClick={onSave}
          disabled={saving}
          title="Сохранить"
        >
          <Check size={16} />
        </button>
        <button
          className="tag-editor-btn tag-editor-btn-cancel"
          onClick={onCancel}
          title="Отмена"
        >
          <X size={16} />
        </button>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="task-modal-overlay">
      <div className="task-modal-container" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h3>{task ? `Редактирование задачи #${task.task_id}` : 'Новая задача'}</h3>
          <button className="task-modal-close" onClick={handleConfirmClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-modal-form">
          <div className="task-modal-body">
            {/* Блок основной информации */}
            <div className="form-section">
              <div className="section-title">
                <FileText size={18} />
                <span>Основная информация</span>
              </div>
              <div className="form-group">
                <label>Название <span className="required">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Купить молоко"
                  autoFocus
                />
                {task && <div className="task-id-hint">ID задачи: #{task.task_id}</div>}
              </div>
              <div className="form-group">
                <label>Описание</label>
                <MarkdownEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Подробности задачи... Поддерживается Markdown"
                  rows={3}
                  defaultPreview={true}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Дата выполнения</label>
                  <div className="input-icon">
                    <Calendar size={16} />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group link-group">
                  <label>Ссылка</label>
                  <div className="input-icon">
                    <ExternalLink size={16} />
                    <input
                      type="text"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <button
                    type="button"
                    className="show-more-btn"
                    onClick={() => setShowMore(!showMore)}
                  >
                    {showMore ? 'Скрыть' : 'Показать больше'}
                    {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Расширяемая секция с датой закрытия */}
              <div className={`expandable-section ${showMore ? 'expanded' : ''}`}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Дата закрытия</label>
                    <div className="input-icon">
                      <Clock size={16} />
                      <input
                        type="datetime-local"
                        value={closedDate}
                        onChange={(e) => setClosedDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Блок тегов */}
            <div className="form-section">
              <div className="section-title">
                <Tag size={18} />
                <span>Теги</span>
              </div>
              <div className="tags-section">
                <div className="current-tags">
                  {taskTags.length === 0 ? (
                    <div className="empty-hint">Нет тегов</div>
                  ) : (
                    taskTags.map(tag => (
                      <div key={tag.task_tag_id} className="tag-chip" style={{ backgroundColor: tag.tag_color }}>
                        {tag.tag_text}
                        <button
                          type="button"
                          className="tag-remove"
                          onClick={() => onRemoveTag(tag.task_tag_id)}
                          title="Удалить тег"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="tag-selector-wrapper" ref={tagSelectorRef}>
                  <button
                    type="button"
                    className="add-tag-btn"
                    onClick={() => setShowTagSelector(!showTagSelector)}
                  >
                    <Plus size={14} /> Добавить тег
                  </button>
                  {showTagSelector && (
                    <div className="tag-selector-dropdown">
                      <div className="tag-list-select">
                        {allTags.filter(t => !taskTags.some(tt => tt.task_tag_id === t.task_tag_id)).map(tag => (
                          <div
                            key={tag.task_tag_id}
                            className="tag-option"
                            onClick={() => {
                              onAssignTag(tag.task_tag_id);
                              setShowTagSelector(false);
                            }}
                          >
                            <span className="tag-color-dot" style={{ backgroundColor: tag.tag_color }} />
                            {tag.tag_text}
                          </div>
                        ))}
                        {allTags.filter(t => !taskTags.some(tt => tt.task_tag_id === t.task_tag_id)).length === 0 && (
                          <div className="no-tags-msg">Все теги уже добавлены</div>
                        )}
                      </div>
                      <TagForm
                        value={newTagText}
                        onChange={setNewTagText}
                        color={newTagColor}
                        onColorChange={setNewTagColor}
                        onSave={handleCreateTag}
                        onCancel={cancelCreateTag}
                        saving={creatingTag}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Блок приоритетов */}
            <div className="form-section">
              <div className="section-title">
                <Flag size={18} />
                <span>Приоритет</span>
              </div>
              <div className="priority-section">
                <div className="priority-options">
                  <button
                    type="button"
                    className={`priority-option ${taskPriorityId === null ? 'selected' : ''}`}
                    onClick={() => setTaskPriorityId(null)}
                  >
                    <span className="priority-none-dot" />
                    Без приоритета
                  </button>
                  {allPriorities?.map(p => (
                    <button
                      key={p.priority_id}
                      type="button"
                      className={`priority-option ${taskPriorityId === p.priority_id ? 'selected' : ''}`}
                      onClick={() => setTaskPriorityId(p.priority_id)}
                      title={`Вес: ${p.priority_sorting_weight}`}
                    >
                      <span className="priority-dot" style={{ backgroundColor: p.priority_color }} />
                      {p.priority_name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Блок комментариев (только для существующей задачи) */}
            {task && (
              <div className="form-section">
                <div className="section-title">
                  <MessageSquare size={18} />
                  <span>Комментарии ({comments.length})</span>
                </div>
                <div className="comments-section">
                  <div className="comments-list">
                    {comments.length === 0 ? (
                      <div className="empty-hint">Нет комментариев</div>
                    ) : (
                      comments.map(comment => (
                        <div key={comment.comment_id} className="comment-item">
                          <div 
                            className="comment-text"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.text) }}
                          />
                          <div className="comment-meta">
                            <span>{new Date(comment.created_at).toLocaleString()}</span>
                            <button
                              type="button"
                              className="delete-comment-btn"
                              onClick={() => handleDeleteComment(comment.comment_id)}
                              title="Удалить комментарий"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="new-comment">
                    <MarkdownEditor
                      value={newCommentText}
                      onChange={setNewCommentText}
                      placeholder="Напишите комментарий... Поддерживается Markdown"
                      rows={2}
                    />
                    <button
                      type="button"
                      className="send-comment-btn"
                      onClick={handleAddComment}
                      disabled={addingComment || !newCommentText.trim()}
                    >
                      <Send size={14} /> Отправить
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="task-modal-footer">
            {task && (
              <button type="button" className="btn-danger" onClick={onDelete}>
                <Trash2 size={16} /> Удалить
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={handleConfirmClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              <Check size={16} /> Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;