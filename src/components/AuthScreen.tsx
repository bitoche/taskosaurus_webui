import React, { useState, useEffect } from 'react';
import { Lock, User as UserIcon, KeyRound, AlertCircle, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { loginUser, registerWithInvite } from '../api';
import { User } from '../types';

interface AuthScreenProps {
  onSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Считываем токен инвайта из URL-параметров (например: /?invite=token)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get('invite');
    if (inv) {
      setInviteToken(inv);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const user = await loginUser(username.trim(), password);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Ошибка входа. Проверьте правильность логина и пароля.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Заполните все обязательные поля');
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      return;
    }
    if (password !== confirmPassword) {
      setError('Введенные пароли не совпадают');
      return;
    }
    if (!inviteToken) {
      setError('Отсутствует токен приглашения');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const user = await registerWithInvite(inviteToken, username.trim(), password);
      // Очищаем токен из URL без перезагрузки
      window.history.replaceState({}, document.title, window.location.pathname);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации. Возможно, инвайт недействителен или устарел.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 space-y-6">
        
        {/* Заголовок */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-2 shadow-inner">
            {inviteToken ? <KeyRound className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {inviteToken ? 'Регистрация по приглашению' : 'Вход в календарь'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {inviteToken
              ? 'Создайте свой аккаунт по персональному инвайту'
              : 'Закрытая система управления персональными задачами'}
          </p>
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            <div className="leading-snug">{error}</div>
          </div>
        )}

        {/* Форма */}
        {inviteToken ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="text-xs px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Токен инвайта активирован</span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Имя пользователя (логин)
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ivan_petrov"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Пароль (минимум 8 символов)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Повторите пароль
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Создание аккаунта...' : 'Зарегистрироваться и войти'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setInviteToken(null);
                  setError(null);
                  window.history.replaceState({}, document.title, window.location.pathname);
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Уже есть учетная запись? Войти
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Имя пользователя
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Пароль
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Вход...' : 'Войти'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Защищенная авторизация и защита от подбора</span>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default AuthScreen;
