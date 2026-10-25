import React, { useState, useRef } from 'react';
import { X, ArrowUpDown, Download, Upload, FileText } from 'lucide-react';
import { exportMyData, importMyData } from '../api';
import { ImportSummary } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Экспорт и импорт данных</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Резервное копирование и перенос ваших задач
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Секция экспорта */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Экспорт данных (резервная копия)
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Скачать все ваши задачи, описания, теги, комментарии и приоритеты в одном JSON-файле.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Формирование файла...' : 'Скачать резервную копию JSON'}
            </button>
          </div>

          {/* Секция импорта */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Импорт данных из файла
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Восстановите или добавьте задачи из ранее сохраненного файла JSON. Теги и приоритеты создадутся автоматически.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json,application/json"
              className="block w-full text-xs text-gray-500 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 dark:file:bg-gray-800 file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-gray-700 cursor-pointer"
            />

            {selectedFile && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 truncate">
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  {importing ? 'Импорт...' : 'Применить'}
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Футер */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-medium cursor-pointer transition-colors"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};

export default DataBackupModal;
