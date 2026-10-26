import React, { useState, useRef, useEffect } from 'react';
import { TaskTag } from '../types';
import { X, Check, Edit2, Trash2 } from 'lucide-react';
import { getContrastTextColor } from '../utils/color';
import './TagManager.css';

interface Props {
  allTags: TaskTag[];
  onCreateTag: (text: string, color: string) => Promise<void>;
  onFilterByTag: (tagId: number | null) => void;
  activeFilterTagId: number | null;
  onDeleteTagGlobally?: (tagId: number) => Promise<void>;
  onUpdateTag?: (tagId: number, text: string, color: string) => Promise<void>;
}

const TagManager: React.FC<Props> = ({ 
  allTags, onCreateTag, onFilterByTag, activeFilterTagId, 
  onDeleteTagGlobally, onUpdateTag 
}) => {
  const [creating, setCreating] = useState(false);
  const [createText, setCreateText] = useState('');
  const [createColor, setCreateColor] = useState('#4a90d9');

  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editColor, setEditColor] = useState('');
  const [updating, setUpdating] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingTagId) return;
    const handler = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditingTagId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingTagId]);

  const handleCreate = async () => {
    const text = createText.trim();
    if (!text || text.length > 255) return;
    setCreating(true);
    try {
      await onCreateTag(text, createColor);
      setCreateText('');
      setCreateColor('#4a90d9');
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (tagId: number) => {
    if (!onDeleteTagGlobally) return;
    if (window.confirm('Удалить тег полностью? Он исчезнет у всех задач.')) {
      await onDeleteTagGlobally(tagId);
      if (activeFilterTagId === tagId) onFilterByTag(null);
    }
  };

  const startEdit = (tag: TaskTag) => {
    setEditText(tag.tag_text);
    setEditColor(tag.tag_color || '#4a90d9');
    setEditingTagId(tag.task_tag_id);
  };

  const handleUpdate = async () => {
    if (!onUpdateTag || editingTagId === null) return;
    const text = editText.trim();
    if (!text || text.length > 255) return;
    setUpdating(true);
    try {
      await onUpdateTag(editingTagId, text, editColor);
      setEditingTagId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const isEditing = (id: number) => editingTagId !== null && id === editingTagId;
  const isActive = (id: number) => activeFilterTagId === id;
  const isDimmed = (id: number) => activeFilterTagId !== null && activeFilterTagId !== id;

  return (
    <div className="tag-manager">
      <h4 className="tag-manager-title">Теги</h4>

      <div className="tag-list" ref={editRef}>
        {/* Фильтр "Все задачи" */}
        <TagItem
          color="#64748b"
          text="Все задачи"
          active={activeFilterTagId === null}
          dimmed={activeFilterTagId !== null}
          onClick={() => onFilterByTag(null)}
          disabled={!!editingTagId || creating}
        />

        {/* Теги */}
        {allTags.map(tag => {
          // Режим редактирования
          if (isEditing(tag.task_tag_id)) {
            return (
              <TagEditItem
                key={tag.task_tag_id}
                initialText={editText}
                initialColor={editColor}
                onTextChange={setEditText}
                onColorChange={setEditColor}
                onSave={handleUpdate}
                onCancel={() => setEditingTagId(null)}
                saving={updating}
              />
            );
          }

          // Обычный тег
          return (
            <TagItem
              key={tag.task_tag_id}
              color={tag.tag_color}
              text={tag.tag_text}
              active={isActive(tag.task_tag_id)}
              dimmed={isDimmed(tag.task_tag_id)}
              onClick={() => onFilterByTag(tag.task_tag_id)}
              disabled={!!editingTagId || creating}
              onEdit={() => startEdit(tag)}
              onDelete={onDeleteTagGlobally ? () => handleDelete(tag.task_tag_id) : undefined}
            />
          );
        })}

        {/* Кнопка "+" */}
        {!editingTagId && (
          <TagItem color="#64748b" text="+" isAdd onClick={creating ? undefined : () => setCreating(true)} disabled={creating} />
        )}

        {/* Форма создания */}
        {creating && (
          <TagEditItem
            key="new"
            isNew
            initialText={createText}
            initialColor={createColor}
            onTextChange={setCreateText}
            onColorChange={setCreateColor}
            onSave={handleCreate}
            onCancel={() => { setCreating(false); setCreateText(''); }}
            saving={creating}
          />
        )}
      </div>
    </div>
  );
};

/* ==================== Обычный тег ==================== */

interface TagItemProps {
  color: string;
  text: string;
  active?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  isAdd?: boolean;
}

const TagItem: React.FC<TagItemProps> = ({
  color, text, active, dimmed, onClick, disabled, onEdit, onDelete, isAdd
}) => {
  const cls = ['task-tag'];
  if (active && !isAdd) cls.push('task-tag-active');
  if (dimmed && !isAdd) cls.push('task-tag-dimmed');
  if (disabled) cls.push('task-tag-disabled');
  if (isAdd) cls.push('task-tag-add');

  const textColor = !isAdd && !disabled && !dimmed ? getContrastTextColor(color) : undefined;

  return (
    <div
      className={cls.join(' ')}
      style={!isAdd && !disabled && !dimmed ? { backgroundColor: color, color: textColor } as React.CSSProperties : undefined}
      onClick={!disabled && onClick ? onClick : undefined}
    >
      <span>{text}</span>
      {!isAdd && (
        <span className="tag-actions" style={{ color: textColor }}>
          {onEdit && (
            <button
              className="tag-action-btn mini-button"
              style={{ color: textColor }}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Редактировать"
            >
              <Edit2 size={12} />
            </button>
          )}
          {onDelete && (
            <button
              className="tag-action-btn mini-button"
              style={{ color: textColor }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Удалить"
            >
              <Trash2 size={12} />
            </button>
          )}
        </span>
      )}
    </div>
  );
};

/* ==================== Inline-форма редактирования/создания ==================== */

interface TagEditItemProps {
  isNew?: boolean;
  initialText: string;
  initialColor: string;
  onTextChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

const TagEditItem: React.FC<TagEditItemProps> = ({
  isNew, initialText, initialColor, onTextChange, onColorChange, onSave, onCancel, saving
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    if (!isNew) inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saving) onSave();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="task-tag task-tag-editing">
      <label className="tag-color-swatch-btn" title="Цвет">
        <input
          type="color"
          value={initialColor}
          onChange={(e) => onColorChange(e.target.value)}
        />
        <span className="tag-color-preview" style={{ backgroundColor: initialColor }} />
      </label>
      <input
        ref={inputRef}
        type="text"
        placeholder={isNew ? 'Название' : 'Название тега'}
        value={initialText}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={255}
      />
      <button
        className="tag-action-btn tag-action-save"
        onClick={onSave}
        title="Сохранить"
      >
        <Check size={12} />
      </button>
      <button
        className="tag-action-btn"
        onClick={onCancel}
        title="Отмена"
      >
        <X size={12} />
      </button>
    </div>
  );
};

export default TagManager;
