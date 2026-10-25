import React, { useState, useEffect } from 'react';
import { Lock, User as UserIcon, KeyRound, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { loginUser, registerWithInvite } from '../api';
import { User } from '../types';
import './AuthScreen.css';

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
      setError('Пожалуйста, заполните имя пользователя и пароль');
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
      window.history.replaceState({}, document.title, window.location.pathname);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации. Возможно, инвайт недействителен или устарел.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        
        {/* Заголовок */}
        <div className="auth-header">
          <div className="auth-icon-badge">
            {inviteToken ? <KeyRound size={26} /> : <Lock size={26} />}
          </div>
          <h1 className="auth-title">
            {inviteToken ? 'Регистрация' : 'Вход в календарь'}
          </h1>
          <p className="auth-subtitle">
            {inviteToken
              ? 'Создание учетной записи по приглашению'
              : 'Календарь и планирование задач'}
          </p>
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="auth-error">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        )}

        {/* Форма */}
        {inviteToken ? (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="auth-invite-badge">
              <CheckCircle2 size={16} />
              <span>Приглашение активно</span>
            </div>

            <div className="auth-field">
              <label className="auth-label">Имя пользователя</label>
              <div className="auth-input-wrapper">
                <UserIcon size={16} className="auth-input-icon" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Пароль (минимум 8 символов)</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Повторите пароль</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? 'Создание аккаунта...' : 'Зарегистрироваться и войти'}
              <ArrowRight size={16} />
            </button>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setInviteToken(null);
                  setError(null);
                  window.history.replaceState({}, document.title, window.location.pathname);
                }}
                className="auth-link-btn"
              >
                Войти в существующий аккаунт
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Имя пользователя</label>
              <div className="auth-input-wrapper">
                <UserIcon size={16} className="auth-input-icon" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Пароль</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              {loading ? 'Вход...' : 'Войти'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default AuthScreen;
