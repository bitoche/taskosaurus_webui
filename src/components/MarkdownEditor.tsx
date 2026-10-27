import React, { useState, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Code, Quote, Edit2, Eye } from 'lucide-react';
import { marked } from 'marked';
import './MarkdownEditor.css';

function escapeHtml(html: string): string {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Попытка через современный Clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Переход к запасному варианту ниже
    }
  }

  // 2. Резервный вариант через execCommand для HTTP/локальных IP и строгих браузерных политик
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Не удалось скопировать в буфер обмена:', err);
    return false;
  }
}

let lastCopiedTime = 0;
let lastCopiedBtn: HTMLElement | null = null;

if (typeof window !== 'undefined') {
  (window as any).__copyMarkdownCode = async (btn: HTMLElement) => {
    if (!btn) return;
    const now = Date.now();
    if (lastCopiedBtn === btn && now - lastCopiedTime < 500) {
      return;
    }
    lastCopiedBtn = btn;
    lastCopiedTime = now;

    const wrapper = btn.closest('.code-block-wrapper');
    const codeElem = wrapper?.querySelector('pre code');
    if (!codeElem) return;

    const rawCode = codeElem.textContent || '';
    const success = await copyToClipboard(rawCode);
    if (success) {
      btn.classList.add('copied');
      const textSpan = btn.querySelector('.copy-text');
      if (textSpan) textSpan.textContent = 'Скопировано!';
      setTimeout(() => {
        btn.classList.remove('copied');
        if (textSpan) textSpan.textContent = 'Скопировать';
      }, 2000);
    }
  };

  if (!(window as any).__copyCodeHandlerAttached) {
    (window as any).__copyCodeHandlerAttached = true;
    // Capture-фаза перехватывает клик до того, как e.stopPropagation() на родительских контейнерах (модалках) его заблокирует
    document.addEventListener(
      'click',
      (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.copy-code-btn');
        if (!btn) return;
        if ((window as any).__copyMarkdownCode) {
          (window as any).__copyMarkdownCode(btn);
        }
      },
      true
    );
  }
}

// Настраиваем marked: gfm, авто-ссылки в новом окне
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Все ссылки открываются в новом окне, многострочный код оборачивается с кнопкой копирования
const renderer = new marked.Renderer();
renderer.link = ({ href, title, text }) => {
  const sanitizedTitle = title ? ` title="${title}"` : '';
  return `<a href="${href}" target="_blank" rel="noopener noreferrer"${sanitizedTitle}>${text}</a>\n`;
};

renderer.code = ({ text, lang }) => {
  const language = (lang || '').trim();
  const escapedText = escapeHtml(text);
  const langDisplay = language || 'code';
  const langClass = language ? ` class="language-${escapeHtml(language)}"` : '';

  return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-block-lang">${escapeHtml(langDisplay)}</span><button type="button" class="copy-code-btn" onclick="window.__copyMarkdownCode && window.__copyMarkdownCode(this)" title="Скопировать код"><span class="copy-icon-wrapper"><svg class="copy-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><svg class="check-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span><span class="copy-text">Скопировать</span></button></div><pre><code${langClass}>${escapedText}</code></pre></div>\n`;
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
