import React, { useState } from 'react';
import { TaskTag } from '../types';
import { X } from 'lucide-react';

interface Props {
  tags: TaskTag[];
  onRemove?: (tagId: number) => void;
  maxVisible?: number;       // сколько показывать, остальные в тултипе
}

const TaskTags: React.FC<Props> = ({ tags, onRemove, maxVisible = 3 }) => {
  const [hoveredTagId, setHoveredTagId] = useState<number | null>(null);
  if (!tags.length) return null;

  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  return (
    <div className="task-tags-container">
      {visibleTags.map(tag => (
        <div
          key={tag.task_tag_id}
          className="task-tag day-card-task-tag"
          style={{ backgroundColor: tag.tag_color || '#e0e0e0' }}
          onMouseEnter={() => setHoveredTagId(tag.task_tag_id)}
          onMouseLeave={() => setHoveredTagId(null)}
        >
          <span>{tag.tag_text}</span>
          {onRemove && (
            <X
              size={12}
              className="tag-remove-icon"
              style={{ opacity: hoveredTagId === tag.task_tag_id ? 1 : 0 }}
              onClick={(e) => { e.stopPropagation(); onRemove(tag.task_tag_id); }}
            />
          )}
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="task-tag day-card-task-tag more-tags" title={tags.slice(maxVisible).map(t => t.tag_text).join(', ')}>
          +{hiddenCount}
        </div>
      )}
    </div>
  );
};

export default TaskTags;