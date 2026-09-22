import { useState } from 'react';
import { api, ApiError } from '../api';
import type { UpdateUserInput } from '../api';
import type { UserDto } from '../types';
import { ErrorText, Switch } from './ui';

export default function SettingsScreen({
  user,
  onUser,
  onToast,
  onLogout
}: {
  user: UserDto;
  onUser: (user: UserDto) => void;
  onToast: (message: string) => void;
  onLogout: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [telegramChatId, setTelegramChatId] = useState(user.telegramChatId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramResult, setTelegramResult] = useState<string | null>(null);

  const describe = (err: unknown) =>
    err instanceof ApiError ? err.message : 'Не удалось связаться с сервером. Проверьте соединение.';

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
      <section className="card stack">
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
          <span className="tiny muted">
            Узнать id можно у бота @userinfobot. Пока бот не настроен, уведомления живут только в приложении.
          </span>
        </label>

        <ErrorText message={error} />

        <div className="row row--wrap">
          <button className="btn btn--soft" type="button" disabled={busy} onClick={() => void saveProfile()}>
            Сохранить
          </button>
          <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => void testTelegram()}>
            Проверить Telegram
          </button>
        </div>

        {telegramResult ? <p className="small muted">{telegramResult}</p> : null}
      </section>

      <section className="card stack">
        <h2 className="card__title">Уведомления</h2>
        <p className="card__hint">Напоминания приходят в ленту приложения, а при настроенном боте — ещё и в Telegram.</p>

        <Switch
          label="Лента в приложении"
          hint="Счётчик непрочитанных в шапке"
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
        <h2 className="card__title">Демо и сервис</h2>
        <p className="card__hint">
          Проверки старта периода и приближения к линии обычно идут по расписанию — здесь их можно запустить вручную.
        </p>
        <div className="row row--wrap">
          <button className="btn btn--ghost btn--small" type="button" disabled={busy} onClick={() => void runChecks()}>
            ▶️ Запустить проверки
          </button>
          <button className="btn btn--danger btn--small" type="button" onClick={onLogout}>
            Выйти из аккаунта
          </button>
        </div>
        <p className="tiny muted">
          Приложение работает как PWA: добавьте его на главный экран телефона, чтобы открывать в один тап.
        </p>
      </section>
    </>
  );
}