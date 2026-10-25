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
  Loader2,
} from 'lucide-react';
import {
  fetchUsersList,
  deleteUser,
  revokeUserSessions,
  exportUserDataByAdmin,
  importUserDataByAdmin,
} from '../api';
import { UserAdmin } from '../types';
import './ManagementModals.css';

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
      `Вы действительно хотите удалить пользователя '${user.username}' и все его задачи (${user.tasks_count} шт.)?`
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
        `Успешный импорт: ${res.tasks_imported} задач, ${res.tags_imported} тегов, ${res.priorities_imported} приоритетов`
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
    <div className="mgmt-modal-overlay" onClick={onClose}>
      <div className="mgmt-modal-card mgmt-modal-card-wide" onClick={(e) => e.stopPropagation()}>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,application/json"
          style={{ display: 'none' }}
        />

        {/* Header */}
        <div className="mgmt-modal-header">
          <div className="mgmt-modal-title-group">
            <div className="mgmt-modal-icon-badge">
              <Users size={20} />
            </div>
            <div>
              <h2 className="mgmt-modal-title">Пользователи системы</h2>
              <p className="mgmt-modal-subtitle">Управление учетными записями, сессиями и данными</p>
            </div>
          </div>
          <button className="mgmt-modal-close-btn" onClick={onClose} title="Закрыть">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="mgmt-modal-body">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 10, color: 'var(--text-hint)' }}>
              <Loader2 size={24} className="spin-loader" />
              <span>Загрузка пользователей...</span>
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-hint)' }}>
              Пользователи не найдены
            </div>
          ) : (
            <div className="mgmt-table-wrapper">
              <table className="mgmt-table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Роль</th>
                    <th>Задач</th>
                    <th>Регистрация</th>
                    <th style={{ textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.user_id === currentAdminId;
                    const isBusy = actionLoadingId === u.user_id;

                    return (
                      <tr key={u.user_id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <UserIcon size={14} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{u.username}</span>
                                {isSelf && (
                                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#e0e7ff', color: '#4338ca' }}>
                                    Вы
                                  </span>
                                )}
                              </div>
                              {u.email && <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{u.email}</div>}
                            </div>
                          </div>
                        </td>

                        <td>
                          {u.role === 'admin' ? (
                            <span className="mgmt-role-badge mgmt-role-admin">
                              <Shield size={12} />
                              Админ
                            </span>
                          ) : (
                            <span className="mgmt-role-badge mgmt-role-user">
                              Пользователь
                            </span>
                          )}
                        </td>

                        <td style={{ fontWeight: 600 }}>{u.tasks_count}</td>

                        <td style={{ color: 'var(--text-hint)', fontSize: 12 }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleRevokeSessions(u)}
                              disabled={isBusy}
                              title="Сбросить сессии"
                              className="mgmt-action-icon-btn"
                              style={{ color: '#d97706' }}
                            >
                              <LogOut size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExportUser(u)}
                              disabled={isBusy}
                              title="Экспорт задач пользователя"
                              className="mgmt-action-icon-btn"
                              style={{ color: '#4f46e5' }}
                            >
                              <Download size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => triggerImportFile(u)}
                              disabled={isBusy}
                              title="Импорт задач в аккаунт"
                              className="mgmt-action-icon-btn"
                              style={{ color: '#059669' }}
                            >
                              <Upload size={16} />
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                disabled={isBusy}
                                title="Удалить аккаунт"
                                className="mgmt-action-icon-btn"
                                style={{ color: '#dc2626' }}
                              >
                                <Trash2 size={16} />
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

        {/* Footer */}
        <div className="mgmt-modal-footer">
          <button type="button" onClick={onClose} className="mgmt-btn-secondary">
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};

export default AdminUsersModal;
