import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { RewardInput } from '../api';
import type { RewardDto, UserDto } from '../types';
import { plural } from '../utils/board';
import { EmptyState, ErrorText, Sheet, Spinner } from './ui';

const EMOJI_CHOICES = ['🎁', '🍫', '☕', '🎬', '🛁', '📚', '🍿', '💆', '🚴', '🎮', '🍕', '🌴'];

/**
 * Награды — «магазин» за кубки: кубок выдаётся за каждое достижение,
 * один кубок = одна награда. Достижения живут в настройках.
 */
export default function RewardsScreen({
  user,
  onUser,
  onToast,
  onDataChanged
}: {
  user: UserDto;
  onUser: (user: UserDto) => void;
  onToast: (message: string) => void;
  onDataChanged: () => void;
}) {
  const [rewards, setRewards] = useState<RewardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardDto | null>(null);
  const [form, setForm] = useState<RewardInput>({ title: '', description: '', emoji: '🎁' });

  const cups = user.cups ?? 0;

  const describe = (err: unknown) =>
    err instanceof ApiError ? err.message : 'Не удалось связаться с сервером. Проверьте соединение.';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRewards(await api.rewards());
      setError(null);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openForm = (reward: RewardDto | null) => {
    setEditingReward(reward);
    setForm(
      reward
        ? { title: reward.title, description: reward.description ?? '', emoji: reward.emoji || '🎁' }
        : { title: '', description: '', emoji: '🎁' }
    );
    setSheetError(null);
    setShowForm(true);
  };

  const saveReward = async () => {
    if (form.title.trim().length === 0) {
      setSheetError('Придумайте название награды.');
      return;
    }

    setBusy(true);
    setSheetError(null);
    try {
      if (editingReward) {
        await api.updateReward(editingReward.id, form);
        onToast('Награда обновлена 🎁');
      } else {
        await api.createReward(form);
        onToast('Награда добавлена 🎁');
      }
      setShowForm(false);
      await load();
      onDataChanged();
    } catch (err) {
      setSheetError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async (reward: RewardDto) => {
    setBusy(true);
    try {
      await api.updateReward(reward.id, {
        title: reward.title,
        description: reward.description,
        emoji: reward.emoji,
        isArchived: !reward.isArchived
      });
      await load();
      onDataChanged();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const removeReward = async (reward: RewardDto) => {
    if (!window.confirm(`Удалить награду «${reward.title}»?`)) return;
    setBusy(true);
    try {
      await api.deleteReward(reward.id);
      await load();
      onDataChanged();
      onToast('Награда удалена');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const redeem = async (reward: RewardDto) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.redeemReward(reward.id);
      onUser(result.user);
      onToast(`${result.reward.emoji} «${result.reward.title}» — ваша! Свободных кубков: ${result.user.cups}`);
      onDataChanged();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && rewards.length === 0) return <Spinner label="Загружаем награды…" />;

  return (
    <>
      <section className="card stack span-full">
        <div className="row row--between row--wrap">
          <div>
            <h2 className="card__title">Награды</h2>
            <p className="card__hint">Один кубок — одна награда. Кубок даётся за каждое достижение.</p>
          </div>
          <div className="row row--wrap">
            <span className="cup-balance">🏆 {cups} свободно</span>
            <button className="btn btn--soft btn--small" type="button" onClick={() => openForm(null)}>
              ➕ Награда
            </button>
          </div>
        </div>

        <ErrorText message={error} />

        {rewards.length === 0 ? (
          <EmptyState
            emoji="🎁"
            title="Наград пока нет"
            hint="Придумайте 2–3 приятных вещи: чашка кофе, серия любимого сериала, прогулка без телефона."
          />
        ) : (
          <div className="list">
            {rewards.map((reward) => (
              <div key={reward.id} className={`list__item ${reward.isArchived ? 'list__item--done' : ''}`}>
                <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>
                  {reward.emoji || '🎁'}
                </span>
                <div className="list__item-main">
                  <p className="list__item-title">{reward.title}</p>
                  {reward.description ? <p className="list__item-meta">{reward.description}</p> : null}
                  {reward.isArchived ? <p className="list__item-meta">в архиве</p> : null}
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <button
                    className="btn btn--small"
                    type="button"
                    disabled={busy || reward.isArchived || cups < 1}
                    onClick={() => void redeem(reward)}
                  >
                    🏆 Забрать
                  </button>
                  <button
                    className="btn btn--ghost btn--small"
                    type="button"
                    disabled={busy}
                    onClick={() => openForm(reward)}
                  >
                    Изменить
                  </button>
                  <button
                    className="btn btn--ghost btn--small"
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleArchive(reward)}
                  >
                    {reward.isArchived ? 'Вернуть' : 'В архив'}
                  </button>
                  <button
                    className="btn btn--danger btn--small"
                    type="button"
                    disabled={busy}
                    onClick={() => void removeReward(reward)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="tiny muted">
          {cups === 0
            ? `Свободных кубков нет — закройте клетку, линию или карточку, и кубок появится. Всего заработано: ${user.cupsEarned ?? 0}.`
            : `Свободно ${cups} ${plural(cups, 'кубок', 'кубка', 'кубков')} · потрачено на награды: ${user.cupsSpent ?? 0}.`}
        </p>
      </section>

      {showForm ? (
        <Sheet title={editingReward ? 'Изменить награду' : 'Новая награда'} onClose={() => setShowForm(false)}>
          <div className="stack">
            <label className="field">
              <span>Название</span>
              <input
                className="input"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Например: вечер без ноутбука"
              />
            </label>
            <label className="field">
              <span>Описание (необязательно)</span>
              <textarea
                className="textarea"
                value={form.description ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
            <div className="field">
              <span>Иконка</span>
              <div className="chips">
                {EMOJI_CHOICES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`chip ${form.emoji === emoji ? 'chip--warn' : ''}`}
                    onClick={() => setForm((current) => ({ ...current, emoji }))}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <ErrorText message={sheetError} />
            <button className="btn btn--block" type="button" disabled={busy} onClick={() => void saveReward()}>
              {busy ? 'Сохраняем…' : editingReward ? 'Сохранить' : 'Добавить награду'}
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
