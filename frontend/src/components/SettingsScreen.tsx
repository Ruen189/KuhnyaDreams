import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { UpdateUserInput } from '../api';
import type { AchievementDto, UserDto } from '../types';
import { formatDateTime } from '../utils/board';
import { applyTheme, getTheme, THEMES } from '../session';
import type { Theme } from '../session';
import { EmptyState, ErrorText, Switch } from './ui';
import HelpSheet from './HelpSheet';

/** Превью палитры для переключателя темы. */
const THEME_DOTS: Record<Theme, string[]> = {
  neon: ['#7c5cff', '#ffcc4d', '#120c2b'],
  light: ['#b25a78', '#d9a75f', '#f2e9dc'],
  dark: ['#8f8f9e', '#d9d9e2', '#1c1c20']
};

export default function SettingsScreen({
  user,
  onUser,
  onToast,
  onLogout,
  unreadCount,
  onOpenNotifications
}: {
  user: UserDto;
  onUser: (user: UserDto) => void;
  onToast: (message: string) => void;
  onLogout: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [telegramChatId, setTelegramChatId] = useState(user.telegramChatId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramResult, setTelegramResult] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const [achievements, setAchievements] = useState<AchievementDto[]>([]);
  const [achievementsError, setAchievementsError] = useState<string | null>(null);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const describe = (err: unknown) =>
    err instanceof ApiError ? err.message : 'Не удалось связаться с сервером. Проверьте соединение.';

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const items = await api.achievements();
        if (alive) setAchievements(items);
      } catch (err) {
        if (alive) setAchievementsError(describe(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pickTheme = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  const patch = async (changes: UpdateUserInput, message: string) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateMe(changes);
      onUser(updated);
      onToast(message);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = () =>
    patch(
      { displayName: displayName.trim() || null, telegramChatId: telegramChatId.trim() || null },
      'Профиль сохранён ✅'
    );

  const testTelegram = async () => {
    setBusy(true);
    setTelegramResult(null);
    setError(null);
    try {
      const result = await api.testTelegram(telegramChatId.trim());
      setTelegramResult(result.message);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const runChecks = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.runChecks();
      onToast(
        result.created > 0
          ? `Фоновые проверки выполнились: новых уведомлений ${result.created} 🔔`
          : 'Проверки выполнились, новых уведомлений нет'
      );
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card stack span-full">
        <div>
          <h2 className="card__title">Профиль</h2>
          <p className="card__hint">{user.email}</p>
        </div>

        <label className="field">
          <span>Как к вам обращаться</span>
          <input
            className="input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Имя"
          />
        </label>

        <label className="field">
          <span>Telegram chat id</span>
          <input
            className="input"
            value={telegramChatId}
            onChange={(event) => setTelegramChatId(event.target.value)}
            placeholder="Например: 123456789"
          />
        </label>

        <ErrorText message={error} />

        <div className="row row--wrap">
          <button className="btn btn--soft" type="button" disabled={busy} onClick={() => void saveProfile()}>
            Сохранить
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            disabled={busy || telegramChatId.trim().length === 0}
            onClick={() => void testTelegram()}
          >
            Проверить Telegram
          </button>
        </div>
        {telegramResult ? <p className="tiny muted">{telegramResult}</p> : null}
      </section>

      <section className="card stack span-full">
        <h2 className="card__title">Тема</h2>
        <div className="theme-options">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`theme-option ${theme === option.id ? 'theme-option--active' : ''}`}
              onClick={() => pickTheme(option.id)}
            >
              <span className="theme-option__head">
                <span aria-hidden="true">{option.emoji}</span>
                {option.label}
              </span>
              <span className="theme-option__dots" aria-hidden="true">
                {THEME_DOTS[option.id].map((color) => (
                  <span key={color} className="theme-option__dot" style={{ background: color }} />
                ))}
              </span>
              <span className="theme-option__hint">{option.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card stack span-full">
        <div className="row row--between row--wrap">
          <h2 className="card__title">🏅 Достижения</h2>
          <span className="cup-balance">🏆 {user.cups ?? 0} свободно</span>
        </div>

        <ErrorText message={achievementsError} />

        {achievements.length === 0 ? (
          <EmptyState
            emoji="🏅"
            title="Достижений ещё нет"
            hint="Первая закрытая клетка уже принесёт достижение и кубок."
          />
        ) : (
          <>
            <div className={`list ${showAllAchievements ? 'list--clamped list--open' : 'list--clamped'}`}>
              {achievements.map((item) => (
                <div key={item.id} className="list__item list__item--done">
                  <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                    🏅
                  </span>
                  <div className="list__item-main">
                    <p className="list__item-title">{item.title}</p>
                    <p className="list__item-meta">{item.description}</p>
                    <p className="list__item-meta">
                      {item.boardTitle} · {formatDateTime(item.unlockedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {achievements.length > 2 ? (
              <button
                className="btn btn--ghost btn--small"
                type="button"
                onClick={() => setShowAllAchievements((current) => !current)}
              >
                {showAllAchievements ? 'Свернуть' : `Показать все (${achievements.length})`}
              </button>
            ) : null}
          </>
        )}
      </section>

      <section className="card stack">
        <div className="row row--between row--wrap">
          <h2 className="card__title">Уведомления</h2>
          <button className="btn btn--soft btn--small" type="button" onClick={onOpenNotifications}>
            🔔 Лента{unreadCount > 0 ? ` · ${unreadCount}` : ''}
          </button>
        </div>
        <Switch
          label="Лента в приложении"
          hint="События копятся в ленте, её можно открыть кнопкой выше"
          checked={user.inAppEnabled}
          onChange={(value) => void patch({ inAppEnabled: value }, value ? 'Лента включена' : 'Лента выключена')}
        />
        <Switch
          label="Telegram"
          hint="Дублировать уведомления в чат с ботом"
          checked={user.telegramEnabled}
          onChange={(value) => void patch({ telegramEnabled: value }, value ? 'Telegram включён' : 'Telegram выключен')}
        />
        <Switch
          label="Старт периода"
          hint="Новая карточка дня, недели или месяца"
          checked={user.notifyOnPeriodStart}
          onChange={(value) => void patch({ notifyOnPeriodStart: value }, 'Настройка сохранена')}
        />
        <Switch
          label="Прогресс и достижения"
          hint="Первая клетка, линии, половина карточки"
          checked={user.notifyOnProgress}
          onChange={(value) => void patch({ notifyOnProgress: value }, 'Настройка сохранена')}
        />
        <Switch
          label="Бинго!"
          hint="Мгновенное сообщение о полной линии"
          checked={user.notifyOnBingo}
          onChange={(value) => void patch({ notifyOnBingo: value }, 'Настройка сохранена')}
        />

        <div className="grid-2">
          <label className="field">
            <span>Тихие часы с</span>
            <select
              className="select"
              value={user.quietHoursStart}
              onChange={(event) => void patch({ quietHoursStart: Number(event.target.value) }, 'Тихие часы обновлены')}
            >
              {Array.from({ length: 24 }, (_, hour) => hour).map((hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Тихие часы до</span>
            <select
              className="select"
              value={user.quietHoursEnd}
              onChange={(event) => void patch({ quietHoursEnd: Number(event.target.value) }, 'Тихие часы обновлены')}
            >
              {Array.from({ length: 24 }, (_, hour) => hour).map((hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card stack">
        <div className="row row--between row--wrap">
          <h2 className="card__title">Помощь</h2>
          <button className="btn btn--soft btn--small" type="button" onClick={() => setShowHelp(true)}>
            ❓ Как играть
          </button>
        </div>
      </section>

      <section className="card stack span-full">
        <h2 className="card__title">Сервис и аккаунт</h2>
        <div className="row row--wrap">
          <button className="btn btn--ghost btn--small" type="button" disabled={busy} onClick={() => void runChecks()}>
            ▶️ Запустить проверки
          </button>
          <button className="btn btn--danger btn--small" type="button" onClick={onLogout}>
            Выйти из аккаунта
          </button>
        </div>
      </section>
      {showHelp ? <HelpSheet onClose={() => setShowHelp(false)} /> : null}
    </>
  );
}

