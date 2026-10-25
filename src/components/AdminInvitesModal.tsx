import React, { useState, useEffect } from 'react';
import { X, KeyRound, Copy, Check, Plus, Clock, ShieldAlert } from 'lucide-react';
import { createInviteToken, fetchActiveInvites } from '../api';
import { InviteToken } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Инвайты для регистрации</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Закрытая генерация ссылок приглашения</p>
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
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Форма создания */}
          <form onSubmit={handleCreate} className="space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Создать новое приглашение
            </h3>
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                  Срок действия ссылки:
                </label>
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                {creating ? 'Генерация...' : 'Создать'}
              </button>
            </div>

            {/* Свежесозданная ссылка */}
            {newInviteLink && (
              <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1.5 animate-in fade-in">
                <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  Одноразовая ссылка готова:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newInviteLink}
                    className="flex-1 text-xs px-2.5 py-1.5 rounded bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-700 font-mono text-gray-700 dark:text-gray-300 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newInviteLink, 'new')}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {copiedToken === 'new' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Список существующих активных инвайтов */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Активные инвайты ({invites.length})
            </h3>

            {loading ? (
              <div className="text-center py-4 text-xs text-gray-400">Загрузка...</div>
            ) : invites.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                Нет активных инвайтов
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {invites.map((inv) => {
                  const link = `${window.location.origin}/?invite=${inv.token}`;
                  const isCopied = copiedToken === inv.token;
                  return (
                    <div
                      key={inv.token}
                      className="p-2.5 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono truncate text-gray-800 dark:text-gray-200 text-[11px]">
                          {inv.token.slice(0, 16)}...
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>До: {new Date(inv.expires_at).toLocaleString()}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(link, inv.token)}
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 flex items-center gap-1 text-[11px] cursor-pointer transition-colors"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Ссылка</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
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

export default AdminInvitesModal;
