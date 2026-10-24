import React, { useState, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Code, Quote, Edit2, Eye } from 'lucide-react';
import { marked } from 'marked';
import './MarkdownEditor.css';

// Настраиваем marked: gfm, авто-ссылки в новом окне
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Все ссылки открываются в новом окне
const renderer = new marked.Renderer();
renderer.link = ({ href, title, text }) => {
  const sanitizedTitle = title ? ` title="${title}"` : '';
  return `<a href="${href}" target="_blank" rel="noopener noreferrer"${sanitizedTitle}>${text}</a>\n`;
};
marked.setOptions({ renderer });

// Markdown рендерер на базе marked
export const renderMarkdown = (text: string): string => {
  if (!text) return '';
  return marked.parse(text, { async: false }) as string;
};

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  className?: string;
  defaultPreview?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  rows = 3, 
  label,
  className,
  defaultPreview = false
}) => {
  const [showPreview, setShowPreview] = useState(defaultPreview);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;
    const selected = text.substring(start, end);
    const newText = text.substring(0, start) + before + selected + after + text.substring(end);
    
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const toolbarButtons = [
    { icon: Bold, action: () => insertMarkdown('**', '**'), title: 'Жирный' },
    { icon: Italic, action: () => insertMarkdown('*', '*'), title: 'Курсив' },
    { icon: List, action: () => insertMarkdown('- '), title: 'Список' },
    { icon: ListOrdered, action: () => insertMarkdown('1. '), title: 'Нумерованный список' },
    { icon: Quote, action: () => insertMarkdown('> '), title: 'Цитата' },
    { icon: Code, action: () => insertMarkdown('`', '`'), title: 'Код' },
    { icon: LinkIcon, action: () => insertMarkdown('[', '](url)'), title: 'Ссылка' },
  ];

  return (
    <div className={`markdown-editor ${className || ''}`}>
      {label && <label>{label}</label>}
      <div className="markdown-toolbar">
        <div className="markdown-buttons">
          {toolbarButtons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              className="markdown-btn"
              onClick={btn.action}
              title={btn.title}
            >
              <btn.icon size={14} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="preview-toggle"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <><Edit2 size={14} /> Редактировать</> : <><Eye size={14} /> Превью</>}
        </button>
      </div>
      {showPreview ? (
        <div 
          className="markdown-preview"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="markdown-textarea"
        />
      )}
    </div>
  );
};

export default MarkdownEditor;
