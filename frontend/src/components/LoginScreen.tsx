import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { UserDto } from '../types';
import { ErrorText } from './ui';

type Mode = 'login' | 'register';

export default function LoginScreen({ onAuthed }: { onAuthed: (user: UserDto) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === 'login'
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), password, displayName.trim() || undefined);
      onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить вход. Проверьте, запущен ли сервер.');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setMode('login');
    setEmail('demo@bingo.local');
    setPassword('demo1234');
    setError(null);
  };

  return (
    <div className="app app--auth">
      <main className="auth">
        <section className="card stack auth__hero">
          <p className="auth__logo" aria-hidden="true">
            🎲
          </p>
          <h1 className="auth__title">Бинго-планировщик</h1>
          <p className="auth__lead">
            Превращаем список дел в игру: закрываешь клетки, собираешь линии, получаешь достижения и награды.
          </p>
          <ul className="auth__features">
            <li>
              <span aria-hidden="true">🎯</span> Задачи с категорией, приоритетом и оценкой времени
            </li>
            <li>
              <span aria-hidden="true">🧩</span> Карточки на день, неделю или месяц — поле 3×3…5×5
            </li>
            <li>
              <span aria-hidden="true">🏆</span> Достижения за клетки, линии и бинго, награды за них
            </li>
            <li>
              <span aria-hidden="true">📈</span> Статистика, серии дней и напоминания в Telegram
            </li>
          </ul>
        </section>

        <form className="card stack auth__form" onSubmit={submit}>
          <h2 className="auth__form-title">{mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}</h2>
          <p className="card__hint">
            {mode === 'login'
              ? 'Введите e-mail и пароль от аккаунта.'
              : 'Пароль от 6 символов, имя можно указать позже в настройках.'}
          </p>
          <div className="chips">
            <button
              type="button"
              className={`chip ${mode === 'login' ? 'chip--warn' : ''}`}
              onClick={() => setMode('login')}
            >
              Вход
            </button>
            <button
              type="button"
              className={`chip ${mode === 'register' ? 'chip--warn' : ''}`}
              onClick={() => setMode('register')}
            >
              Регистрация
            </button>
          </div>

          <label className="field">
            <span>E-mail</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          {mode === 'register' ? (
            <label className="field">
              <span>Как вас называть</span>
              <input
                className="input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Имя"
              />
            </label>
          ) : null}

          <label className="field">
            <span>Пароль</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Минимум 6 символов"
            />
          </label>

          <ErrorText message={error} />

          <button className="btn btn--block" type="submit" disabled={busy}>
            {busy ? 'Секунду…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>

          <button className="btn btn--ghost btn--block btn--small" type="button" onClick={fillDemo}>
            Демо-доступ (demo@bingo.local / demo1234)
          </button>
        </form>
      </main>
    </div>
  );
}