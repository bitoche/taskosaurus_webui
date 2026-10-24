import React, { useState, useRef, useEffect } from 'react';
import { TaskPriority } from '../types';
import { X, Check, Edit2, Trash2 } from 'lucide-react';
import './PriorityManager.css';

interface Props {
  allPriorities: TaskPriority[];
  onCreatePriority: (name: string, color: string, weight: number) => Promise<void>;
  onFilterByPriority: (priorityId: number | null) => void;
  activeFilterPriorityId: number | null;
  onDeletePriority?: (priorityId: number) => Promise<void>;
  onUpdatePriority?: (priorityId: number, name: string, color: string, weight: number) => Promise<void>;
}

const PriorityManager: React.FC<Props> = ({
  allPriorities,
  onCreatePriority,
  onFilterByPriority,
  activeFilterPriorityId,
  onDeletePriority,
  onUpdatePriority,
}) => {
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState('#ef4444');
  const [createWeight, setCreateWeight] = useState('0');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [updating, setUpdating] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingId) return;
    const handler = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingId]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name || name.length > 255) return;
    const weight = parseInt(createWeight, 10) || 0;
    setCreating(true);
    try {
      await onCreatePriority(name, createColor, weight);
      setCreateName('');
      setCreateColor('#ef4444');
      setCreateWeight('0');
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (priorityId: number) => {
    if (!onDeletePriority) return;
    if (window.confirm('Удалить приоритет? У всех задач он будет снят.')) {
      await onDeletePriority(priorityId);
      if (activeFilterPriorityId === priorityId) onFilterByPriority(null);
    }
  };

  const startEdit = (p: TaskPriority) => {
    setEditName(p.priority_name);
    setEditColor(p.priority_color || '#ef4444');
    setEditWeight(String(p.priority_sorting_weight));
    setEditingId(p.priority_id);
  };

  const handleUpdate = async () => {
    if (!onUpdatePriority || editingId === null) return;
    const name = editName.trim();
    if (!name || name.length > 255) return;
    const weight = parseInt(editWeight, 10) || 0;
    setUpdating(true);
    try {
      await onUpdatePriority(editingId, name, editColor, weight);
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const isEditing = (id: number) => editingId !== null && id === editingId;
  const isActive = (id: number) => activeFilterPriorityId === id;
  const isDimmed = (id: number) => activeFilterPriorityId !== null && activeFilterPriorityId !== id;

  return (
    <div className="priority-manager">
      <h4 className="priority-manager-title">Приоритеты</h4>

      <div className="priority-list" ref={editRef}>
        {/* Фильтр "Все задачи" */}
        <PriorityItem
          color="#64748b"
          name="Все задачи"
          active={activeFilterPriorityId === null}
          dimmed={activeFilterPriorityId !== null}
          onClick={() => onFilterByPriority(null)}
          disabled={!!editingId || creating}
        />

        {/* Приоритеты */}
        {allPriorities.map(p => {
          if (isEditing(p.priority_id)) {
            return (
              <PriorityEditItem
                key={p.priority_id}
                initialName={editName}
                initialColor={editColor}
                initialWeight={editWeight}
                onNameChange={setEditName}
                onColorChange={setEditColor}
                onWeightChange={setEditWeight}
                onSave={handleUpdate}
                onCancel={() => setEditingId(null)}
                saving={updating}
              />
            );
          }

          return (
            <PriorityItem
              key={p.priority_id}
              color={p.priority_color}
              name={p.priority_name}
              weight={p.priority_sorting_weight}
              active={isActive(p.priority_id)}
              dimmed={isDimmed(p.priority_id)}
              onClick={() => onFilterByPriority(p.priority_id)}
              disabled={!!editingId || creating}
              onEdit={() => startEdit(p)}
              onDelete={onDeletePriority ? () => handleDelete(p.priority_id) : undefined}
            />
          );
        })}

        {/* Кнопка "+" */}
        {!editingId && (
          <PriorityItem color="#64748b" name="+" isAdd onClick={creating ? undefined : () => setCreating(true)} disabled={creating} />
        )}

        {/* Форма создания */}
        {creating && (
          <PriorityEditItem
            key="new"
            isNew
            initialName={createName}
            initialColor={createColor}
            initialWeight={createWeight}
            onNameChange={setCreateName}
            onColorChange={setCreateColor}
            onWeightChange={setCreateWeight}
            onSave={handleCreate}
            onCancel={() => { setCreating(false); setCreateName(''); }}
            saving={creating}
          />
        )}
      </div>
    </div>
  );
};

/* ==================== Обычный приоритет ==================== */

interface PriorityItemProps {
  color: string;
  name: string;
  weight?: number;
  active?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  isAdd?: boolean;
}

const PriorityItem: React.FC<PriorityItemProps> = ({
  color, name, weight, active, dimmed, onClick, disabled, onEdit, onDelete, isAdd,
}) => {
  const cls = ['priority-item'];
  if (active && !isAdd) cls.push('priority-item-active');
  if (dimmed && !isAdd) cls.push('priority-item-dimmed');
  if (disabled) cls.push('priority-item-disabled');
  if (isAdd) cls.push('priority-item-add');

  return (
    <div
      className={cls.join(' ')}
      style={!isAdd && !disabled && !dimmed ? { borderColor: color, color: active ? 'black' : undefined, backgroundColor: active ? color : undefined } as React.CSSProperties : undefined}
      onClick={!disabled && onClick ? onClick : undefined}
    >
      {!isAdd && !active && !dimmed && <span className="priority-color-dot" style={{ backgroundColor: color }} />}
      <span>{name}</span>
      {weight !== undefined && !isAdd && <span className="priority-weight">{weight}</span>}
      {!isAdd && (
        <span className="priority-actions">
          {onEdit && (
            <button className="priority-action-btn mini-button" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Редактировать">
              <Edit2 size={12} />
            </button>
          )}
          {onDelete && (
            <button className="priority-action-btn mini-button" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Удалить">
              <Trash2 size={12} />
            </button>
          )}
        </span>
      )}
    </div>
  );
};

/* ==================== Inline-форма редактирования/создания ==================== */

interface PriorityEditItemProps {
  isNew?: boolean;
  initialName: string;
  initialColor: string;
  initialWeight: string;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onWeightChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

const PriorityEditItem: React.FC<PriorityEditItemProps> = ({
  isNew, initialName, initialColor, initialWeight, onNameChange, onColorChange, onWeightChange, onSave, onCancel, saving,
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
    <div className="priority-item priority-item-editing">
      <label className="priority-color-swatch-btn" title="Цвет">
        <input type="color" value={initialColor} onChange={(e) => onColorChange(e.target.value)} />
        <span className="priority-color-preview" style={{ backgroundColor: initialColor }} />
      </label>
      <input
        ref={inputRef}
        type="text"
        placeholder={isNew ? 'Название' : 'Название приоритета'}
        value={initialName}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={255}
      />
      <input
        type="number"
        className="priority-weight-input"
        placeholder="Вес"
        value={initialWeight}
        onChange={(e) => onWeightChange(e.target.value)}
        onKeyDown={handleKeyDown}
        title="Вес сортировки (меньше = выше)"
      />
      <button className="priority-action-btn priority-action-save" onClick={onSave} title="Сохранить">
        <Check size={12} />
      </button>
      <button className="priority-action-btn" onClick={onCancel} title="Отмена">
        <X size={12} />
      </button>
    </div>
  );
};

export default PriorityManager;
