import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  Shield,
  User as UserIcon,
  Trash2,
  LogOut,
  Download,
  Upload,
} from 'lucide-react';
import {
  fetchUsersList,
  deleteUser,
  revokeUserSessions,
  exportUserDataByAdmin,
  importUserDataByAdmin,
} from '../api';
import { UserAdmin } from '../types';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAdminId: number;
  onNotify: (type: 'info' | 'warning' | 'error', message: string) => void;
  onRefreshData?: () => void;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  currentAdminId,
  onNotify,
  onRefreshData,
}) => {
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [targetImportUserId, setTargetImportUserId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await fetchUsersList();
      setUsers(list);
    } catch (err: any) {
      onNotify('error', err.message || 'Ошибка загрузки списка пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRevokeSessions = async (user: UserAdmin) => {
    if (!window.confirm(`Сбросить все активные сессии пользователя '${user.username}'? Ему потребуется войти заново.`)) {
      return;
    }

    setActionLoadingId(user.user_id);
    try {
      const res = await revokeUserSessions(user.user_id);
      onNotify('info', res.message || `Сессии пользователя ${user.username} отозваны`);
      await loadUsers();
    } catch (err: any) {
      onNotify('error', err.message || 'Не удалось сбросить сессии');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (user: UserAdmin) => {
    if (user.user_id === currentAdminId) {
      alert('Нельзя удалить собственный аккаунт администратора.');
      return;
    }

    const confirmed = window.confirm(
      `ВНИМАНИЕ! Вы действительно хотите безвозвратно удалить пользователя '${user.username}' и все его задачи (${user.tasks_count} шт.)?`
    );
    if (!confirmed) return;

    setActionLoadingId(user.user_id);
    try {
      await deleteUser(user.user_id);
      onNotify('info', `Пользователь '${user.username}' успешно удален`);
      await loadUsers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      onNotify('error', err.message || 'Не удалось удалить пользователя');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExportUser = async (user: UserAdmin) => {
    setActionLoadingId(user.user_id);
    try {
      const data = await exportUserDataByAdmin(user.user_id);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${user.username}_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('info', `Данные пользователя '${user.username}' успешно экспортированы`);
    } catch (err: any) {
      onNotify('error', err.message || 'Ошибка экспорта данных');
    } finally {
      setActionLoadingId(null);
    }
  };

  const triggerImportFile = (user: UserAdmin) => {
    setTargetImportUserId(user.user_id);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || targetImportUserId === null) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setActionLoadingId(targetImportUserId);
      const res = await importUserDataByAdmin(targetImportUserId, parsed);
      onNotify(
        'info',
        `Успешный импорт: задач ${res.tasks_imported}, приоритетов ${res.priorities_imported}, тегов ${res.tags_imported}, комментариев ${res.comments_imported}`
      );
      await loadUsers();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      onNotify('error', `Ошибка импорта: ${err.message || 'Некорректный JSON файл'}`);
    } finally {
      setActionLoadingId(null);
      setTargetImportUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Скрытый инпут для выбора файла импорта */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,application/json"
          style={{ display: 'none' }}
        />

        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Управление пользователями</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Сессии, удаление аккаунтов, экспорт и импорт данных
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

        {/* Таблица пользователей */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="text-center py-8 text-xs text-gray-400">Загрузка пользователей...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">Пользователи не найдены</div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Пользователь</th>
                    <th className="py-2.5 px-3">Роль</th>
                    <th className="py-2.5 px-3">Задач</th>
                    <th className="py-2.5 px-3">Регистрация</th>
                    <th className="py-2.5 px-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {users.map((u) => {
                    const isSelf = u.user_id === currentAdminId;
                    const isBusy = actionLoadingId === u.user_id;

                    return (
                      <tr key={u.user_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
                              <UserIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <span>{u.username}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                    Вы
                                  </span>
                                )}
                              </div>
                              {u.email && <div className="text-[11px] text-gray-400">{u.email}</div>}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              <Shield className="w-3 h-3" />
                              Админ
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              Пользователь
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-medium text-gray-700 dark:text-gray-300">
                          {u.tasks_count}
                        </td>

                        <td className="py-3 px-3 text-gray-400 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Сброс сессий */}
                            <button
                              type="button"
                              onClick={() => handleRevokeSessions(u)}
                              disabled={isBusy}
                              title="Отозвать все сессии (выбить со всех устройств)"
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>

                            {/* Экспорт данных */}
                            <button
                              type="button"
                              onClick={() => handleExportUser(u)}
                              disabled={isBusy}
                              title="Экспорт всех данных в JSON"
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* Импорт данных */}
                            <button
                              type="button"
                              onClick={() => triggerImportFile(u)}
                              disabled={isBusy}
                              title="Импорт данных из JSON"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                            >
                              <Upload className="w-4 h-4" />
                            </button>

                            {/* Удалить пользователя */}
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                disabled={isBusy}
                                title="Удалить пользователя"
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer ml-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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

export default AdminUsersModal;
