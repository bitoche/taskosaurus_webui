import React, { useState, useRef } from 'react';
import { X, ArrowUpDown, Download, Upload, FileText, Loader2 } from 'lucide-react';
import { exportMyData, importMyData } from '../api';
import { ImportSummary } from '../types';
import './ManagementModals.css';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  onNotify: (type: 'info' | 'warning' | 'error', message: string) => void;
  onRefreshData: () => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  username,
  onNotify,
  onRefreshData,
}) => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportMyData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${username}_tasks_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('info', 'Резервная копия ваших данных успешно скачана');
    } catch (err: any) {
      onNotify('error', err.message || 'Ошибка экспорта данных');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    try {
      const text = await selectedFile.text();
      const parsed = JSON.parse(text);
      const res: ImportSummary = await importMyData(parsed);
      onNotify(
        'info',
        `Успешно импортировано: ${res.tasks_imported} задач, ${res.tags_imported} тегов, ${res.priorities_imported} приоритетов`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onRefreshData();
      onClose();
    } catch (err: any) {
      onNotify('error', `Ошибка импорта: ${err.message || 'Некорректный JSON файл'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mgmt-modal-overlay">
      <div className="mgmt-modal-card">
        {/* Заголовок */}
        <div className="mgmt-modal-header">
          <div className="mgmt-modal-title-group">
            <div className="mgmt-modal-icon-badge">
              <ArrowUpDown size={20} />
            </div>
            <div>
              <h2 className="mgmt-modal-title">Экспорт и импорт данных</h2>
              <p className="mgmt-modal-subtitle">
                Резервное копирование и перенос ваших задач
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mgmt-modal-close-btn"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Тело */}
        <div className="mgmt-modal-body">
          {/* Секция экспорта */}
          <div className="mgmt-section-box">
            <h3 className="mgmt-section-title">
              <Download size={16} color="#4f46e5" />
              Экспорт данных (резервная копия)
            </h3>
            <p className="mgmt-section-desc">
              Скачать все ваши задачи, описания, теги, комментарии и приоритеты в одном JSON-файле.
            </p>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="mgmt-btn-primary"
            >
              {exporting ? <Loader2 size={14} className="spin-loader" /> : <Download size={14} />}
              {exporting ? 'Формирование файла...' : 'Скачать резервную копию JSON'}
            </button>
          </div>

          {/* Секция импорта */}
          <div className="mgmt-section-box">
            <h3 className="mgmt-section-title">
              <Upload size={16} color="#10b981" />
              Импорт данных из файла
            </h3>
            <p className="mgmt-section-desc">
              Восстановите или добавьте задачи из сохраненного ранее JSON. Теги и приоритеты создадутся автоматически.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json,application/json"
              className="mgmt-file-input"
            />

            {selectedFile && (
              <div className="mgmt-file-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                  <FileText size={16} color="#059669" />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {selectedFile.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="mgmt-btn-success"
                  style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                >
                  {importing ? <Loader2 size={12} className="spin-loader" /> : <Upload size={12} />}
                  {importing ? 'Импорт...' : 'Применить'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Футер */}
        <div className="mgmt-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="mgmt-btn-secondary"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataBackupModal;
