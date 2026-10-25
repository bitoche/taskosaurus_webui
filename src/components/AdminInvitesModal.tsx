import React, { useState, useEffect } from 'react';
import { X, KeyRound, Copy, Check, Plus, Clock, ShieldAlert } from 'lucide-react';
import { createInviteToken, fetchActiveInvites } from '../api';
import { InviteToken } from '../types';
import './ManagementModals.css';

interface AdminInvitesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminInvitesModal: React.FC<AdminInvitesModalProps> = ({ isOpen, onClose }) => {
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hours, setHours] = useState(48);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvites = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchActiveInvites();
      setInvites(list);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить список инвайтов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadInvites();
      setNewInviteLink(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const invite = await createInviteToken(hours);
      const link = `${window.location.origin}/?invite=${invite.token}`;
      setNewInviteLink(link);
      await loadInvites();
    } catch (err: any) {
      setError(err.message || 'Не удалось создать инвайт');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (text: string, token: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="mgmt-modal-overlay" onClick={onClose}>
      <div className="mgmt-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="mgmt-modal-header">
          <div className="mgmt-modal-title-group">
            <div className="mgmt-modal-icon-badge">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="mgmt-modal-title">Приглашения (инвайты)</h2>
              <p className="mgmt-modal-subtitle">Создание ссылок для регистрации новых пользователей</p>
            </div>
          </div>
          <button className="mgmt-modal-close-btn" onClick={onClose} title="Закрыть">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="mgmt-modal-body">
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Форма генерации инвайта */}
          <form onSubmit={handleCreate} className="mgmt-section-box">
            <h3 className="mgmt-section-title">Создать новое приглашение</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="mgmt-select"
                  style={{ width: '100%' }}
                >
                  <option value={12}>12 часов</option>
                  <option value={24}>24 часа (1 сутки)</option>
                  <option value={48}>48 часов (2 суток)</option>
                  <option value={168}>7 дней</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="mgmt-btn-primary"
              >
                <Plus size={16} />
                <span>{creating ? 'Создание...' : 'Создать'}</span>
              </button>
            </div>

            {newInviteLink && (
              <div className="mgmt-link-box" style={{ marginTop: 6 }}>
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

          {/* Активные инвайты */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Активные инвайты ({invites.length})
            </h3>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: 'var(--text-hint)' }}>
                Загрузка...
              </div>
            ) : invites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-hint)', border: '1px dashed var(--border-color)', borderRadius: 12 }}>
                Нет активных инвайтов
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {invites.map((inv) => {
                  const link = `${window.location.origin}/?invite=${inv.token}`;
                  const isCopied = copiedToken === inv.token;
                  return (
                    <div
                      key={inv.token}
                      style={{
                        padding: '10px 12px',
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
                        <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inv.token.slice(0, 18)}...
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                          <Clock size={12} />
                          <span>Действителен до: {new Date(inv.expires_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(link, inv.token)}
                        className="mgmt-btn-secondary"
                        style={{ height: 30, padding: '0 10px', fontSize: 11 }}
                      >
                        {isCopied ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                        <span>{isCopied ? 'Скопировано' : 'Ссылка'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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

export default AdminInvitesModal;
