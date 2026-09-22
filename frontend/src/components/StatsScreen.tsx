import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { StatsResponse } from '../types';
import { PERIOD_LABELS } from '../types';
import { periodRangeLabel } from '../utils/board';
import { EmptyState, ErrorText, Spinner, StatTile } from './ui';

const RANGES = [7, 30, 90];

export default function StatsScreen() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const describe = (err: unknown) =>
    err instanceof ApiError ? err.message : 'Не удалось связаться с сервером. Проверьте соединение.';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await api.stats(days));
      setError(null);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stats) return <Spinner label="Считаем статистику…" />;

  const maxDaily = Math.max(1, ...(stats?.daily.map((item) => item.completed) ?? [1]));

  return (
    <>
      <section className="card stack">
        <div className="row row--between row--wrap">
          <div>
            <h2 className="card__title">Прогресс</h2>
            <p className="card__hint">Сколько клеток закрыто, какие линии собраны и как держится серия.</p>
          </div>
          <div className="chips">
            {RANGES.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${days === value ? 'chip--warn' : ''}`}
                onClick={() => setDays(value)}
              >
                {value} дней
              </button>
            ))}
          </div>
        </div>

        <ErrorText message={error} />

        {stats ? (
          <>
            <div className="grid-2">
              <StatTile emoji="✅" value={stats.summary.completedCells} label="клеток закрыто" />
              <StatTile emoji="📏" value={stats.summary.linesCollected} label="линий собрано" />
              <StatTile emoji="🎉" value={stats.summary.bingosCollected} label="полных карточек" />
              <StatTile emoji="🎁" value={stats.summary.rewardsRedeemed} label="наград получено" />
              <StatTile emoji="🔥" value={stats.summary.currentStreakDays} label="дней подряд сейчас" />
              <StatTile emoji="🏅" value={stats.summary.longestStreakDays} label="лучшая серия, дней" />
              <StatTile emoji="🗒" value={stats.summary.totalTasks} label="задач всего" />
              <StatTile emoji="🎲" value={`${stats.summary.activeBoards} / ${stats.summary.completedBoards}`} label="активных / закрытых карточек" />
            </div>

            <div className="stack">
              <strong className="small">Активность по дням</strong>
              <div className="bars" aria-hidden="true">
                {stats.daily.map((item) => (
                  <div
                    key={item.date}
                    className="bars__bar"
                    style={{ height: `${Math.max(4, Math.round((item.completed / maxDaily) * 100))}%` }}
                    title={`${item.date}: ${item.completed}`}
                  />
                ))}
              </div>
              <span className="tiny muted">
                {stats.daily.length > 0
                  ? `с ${stats.daily[0].date} по ${stats.daily[stats.daily.length - 1].date} · максимум за день: ${maxDaily}`
                  : 'нет данных'}
              </span>
            </div>
          </>
        ) : null}
      </section>

      <section className="card stack">
        <h2 className="card__title">Категории</h2>
        {stats && stats.categories.length > 0 ? (
          <div className="list">
            {stats.categories.map((item) => (
              <div key={item.category} className="stack" style={{ gap: 6 }}>
                <div className="row row--between">
                  <span className="small">{item.category}</span>
                  <span className="tiny muted">
                    {item.completed} из {item.total}
                  </span>
                </div>
                <div className="progress">
                  <div
                    className="progress__value"
                    style={{ width: `${item.total === 0 ? 0 : Math.round((item.completed / item.total) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState emoji="📊" title="Данных пока нет" hint="Закройте несколько клеток — и здесь появится разбивка по категориям." />
        )}
      </section>

      <section className="card stack">
        <h2 className="card__title">История карточек</h2>
        {stats && stats.history.length > 0 ? (
          <div className="list">
            {stats.history.map((item) => (
              <div key={item.id} className="list__item">
                <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                  {item.hasBingo ? '🎉' : item.status === 2 ? '📦' : '🎲'}
                </span>
                <div className="list__item-main">
                  <p className="list__item-title">{item.title}</p>
                  <p className="list__item-meta">
                    {PERIOD_LABELS[item.period]} · {periodRangeLabel(item.period, item.startDate, item.endDate)} ·{' '}
                    {item.completedCells}/{item.playableCells} ({item.percent}%) · линий: {item.completedLines}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState emoji="🗂" title="История пуста" hint="Карточки появятся здесь после создания." />
        )}
      </section>
    </>
  );
}