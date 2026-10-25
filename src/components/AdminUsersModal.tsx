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
  KeyRound,
  Plus,
  Copy,
  Check,
  Clock,
} from 'lucide-react';
import {
  fetchUsersList,
  deleteUser,
  revokeUserSessions,
  exportUserDataByAdmin,
  importUserDataByAdmin,
  createInviteToken,
  fetchActiveInvites,
  deleteInviteToken,
} from '../api';
import { UserAdmin, InviteToken } from '../types';
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
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users');

  // Состояние пользователей
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [targetImportUserId, setTargetImportUserId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Состояние инвайтов
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [deletingInviteToken, setDeletingInviteToken] = useState<string | null>(null);
  const [inviteHours, setInviteHours] = useState(48);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);

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

  const loadInvites = async () => {
    setInvitesLoading(true);
    try {
      const list = await fetchActiveInvites();
      setInvites(list);
    } catch (err: any) {
      onNotify('error', err.message || 'Не удалось загрузить список инвайтов');
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      loadInvites();
      setNewInviteLink(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Действия пользователей ---
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

  // --- Действия инвайтов ---
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingInvite(true);
    try {
      const invite = await createInviteToken(inviteHours);
      const link = `${window.location.origin}/?invite=${invite.token}`;
      setNewInviteLink(link);
      onNotify('info', 'Инвайт успешно создан');
      await loadInvites();
    } catch (err: any) {
      onNotify('error', err.message || 'Не удалось создать инвайт');
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyToClipboard = async (text: string, token: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(token);
      onNotify('info', 'Ссылка приглашения скопирована в буфер обмена');
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      onNotify('error', 'Не удалось скопировать ссылку');
    }
  };

  const handleDeleteInvite = async (token: string) => {
    if (!window.confirm('Отозвать и удалить этот инвайт? Ссылка перестанет действовать.')) return;
    setDeletingInviteToken(token);
    try {
      await deleteInviteToken(token);
      setInvites((prev) => prev.filter((i) => i.token !== token));
      if (newInviteLink?.includes(token)) {
        setNewInviteLink(null);
      }
      onNotify('info', 'Инвайт успешно отозван и удален');
    } catch (err: any) {
      onNotify('error', err.message || 'Не удалось удалить инвайт');
    } finally {
      setDeletingInviteToken(null);
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
              <Shield size={20} />
            </div>
            <div>
              <h2 className="mgmt-modal-title">Панель администратора</h2>
              <p className="mgmt-modal-subtitle">
                {activeTab === 'users'
                  ? 'Управление учетными записями, сессиями и данными'
                  : 'Создание и управление ссылками для регистрации'}
              </p>
            </div>
          </div>
          <button className="mgmt-modal-close-btn" onClick={onClose} title="Закрыть">
            <X size={20} />
          </button>
        </div>

        {/* Tabs navigation */}
        <div className="mgmt-tabs-nav">
          <button
            type="button"
            className={`mgmt-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} />
            <span>Пользователи</span>
            {users.length > 0 && <span className="mgmt-tab-badge">{users.length}</span>}
          </button>
          <button
            type="button"
            className={`mgmt-tab-btn ${activeTab === 'invites' ? 'active' : ''}`}
            onClick={() => setActiveTab('invites')}
          >
            <KeyRound size={16} />
            <span>Инвайты</span>
            {invites.length > 0 && <span className="mgmt-tab-badge">{invites.length}</span>}
          </button>
        </div>

        {/* Body */}
        <div className="mgmt-modal-body">
          {activeTab === 'users' && (
            <>
              {loading ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 0',
                    gap: 10,
                    color: 'var(--text-hint)',
                  }}
                >
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
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.06)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <UserIcon size={14} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{u.username}</span>
                                    {isSelf && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          padding: '1px 5px',
                                          borderRadius: 4,
                                          background: '#e0e7ff',
                                          color: '#4338ca',
                                        }}
                                      >
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
                                <span className="mgmt-role-badge mgmt-role-user">Пользователь</span>
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
            </>
          )}

          {activeTab === 'invites' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Форма генерации инвайта */}
              <form onSubmit={handleCreateInvite} className="mgmt-section-box">
                <h3 className="mgmt-section-title">Создать новое приглашение</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <select
                      value={inviteHours}
                      onChange={(e) => setInviteHours(Number(e.target.value))}
                      className="mgmt-select"
                      style={{ width: '100%' }}
                    >
                      <option value={12}>12 часов</option>
                      <option value={24}>24 часа (1 сутки)</option>
                      <option value={48}>48 часов (2 суток)</option>
                      <option value={168}>7 дней</option>
                    </select>
                  </div>

                  <button type="submit" disabled={creatingInvite} className="mgmt-btn-primary">
                    {creatingInvite ? <Loader2 size={16} className="spin-loader" /> : <Plus size={16} />}
                    <span>{creatingInvite ? 'Создание...' : 'Создать'}</span>
                  </button>
                </div>

                {newInviteLink && (
                  <div className="mgmt-link-box" style={{ marginTop: 10 }}>
                    <input
                      type="text"
                      readOnly
                      value={newInviteLink}
                      className="mgmt-link-input"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(newInviteLink, 'new')}
                      className="mgmt-btn-success"
                      style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                    >
                      {copiedToken === 'new' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedToken === 'new' ? 'Скопировано' : 'Копировать'}</span>
                    </button>
                  </div>
                )}
              </form>

              {/* Список активных инвайтов */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Активные инвайты ({invites.length})
                </h3>

                {invitesLoading ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px 0',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--text-hint)',
                    }}
                  >
                    <Loader2 size={20} className="spin-loader" />
                    <span>Загрузка инвайтов...</span>
                  </div>
                ) : invites.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 0',
                      fontSize: 13,
                      color: 'var(--text-hint)',
                      border: '1px dashed var(--border-color)',
                      borderRadius: 12,
                    }}
                  >
                    Нет активных инвайтов
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {invites.map((inv) => {
                      const link = `${window.location.origin}/?invite=${inv.token}`;
                      const isCopied = copiedToken === inv.token;
                      return (
                        <div
                          key={inv.token}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-comment)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 12,
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {inv.token.slice(0, 20)}...
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                color: 'var(--text-hint)',
                                marginTop: 2,
                              }}
                            >
                              <Clock size={12} />
                              <span>Действителен до: {new Date(inv.expires_at).toLocaleString()}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(link, inv.token)}
                              className="mgmt-btn-secondary"
                              style={{ height: 30, padding: '0 10px', fontSize: 11 }}
                            >
                              {isCopied ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                              <span>{isCopied ? 'Скопировано' : 'Ссылка'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInvite(inv.token)}
                              disabled={deletingInviteToken === inv.token}
                              className="mgmt-action-icon-btn"
                              title="Отозвать и удалить инвайт"
                              style={{ color: '#ef4444', height: 30, width: 30, padding: 0 }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
