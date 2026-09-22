import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { RewardInput } from '../api';
import type { AchievementDto, RewardDto } from '../types';
import { AchievementStatus } from '../types';
import AchievementSheet from './AchievementSheet';
import { EmptyState, ErrorText, Sheet, Spinner } from './ui';

const EMOJI_CHOICES = ['🎁', '🍫', '☕', '🎬', '🛁', '📚', '🍿', '💆', '🚴', '🎮', '🍕', '🌴'];

const STATUS_LABELS: Record<AchievementStatus, string> = {
  [AchievementStatus.Suggested]: 'ждёт награды',
  [AchievementStatus.Rewarded]: 'награда выбрана',
  [AchievementStatus.Skipped]: 'пропущено'
};

export default function RewardsScreen({
  onToast,
  onDataChanged
}: {
  onToast: (message: string) => void;
  onDataChanged: () => void;
}) {
  const [rewards, setRewards] = useState<RewardDto[]>([]);
  const [achievements, setAchievements] = useState<AchievementDto[]>([]);
  const [pending, setPending] = useState<AchievementDto[]>([]);
  const [suggested, setSuggested] = useState<RewardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardDto | null>(null);
  const [form, setForm] = useState<RewardInput>({ title: '', description: '', emoji: '🎁' });
  const [celebrating, setCelebrating] = useState<AchievementDto[]>([]);

  const describe = (err: unknown) =>
    err instanceof ApiError ? err.message : 'Не удалось связаться с сервером. Проверьте соединение.';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rewardList, achievementList] = await Promise.all([api.rewards(), api.achievements()]);
      setRewards(rewardList);
      setAchievements(achievementList);
      setPending(achievementList.filter((item) => item.status === AchievementStatus.Suggested));
      setSuggested(rewardList.filter((item) => !item.isArchived));
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

  const resolve = async (achievementId: string, rewardId: string | null, skip: boolean) => {
    setBusy(true);
    setSheetError(null);
    try {
      await api.resolveAchievement(achievementId, rewardId, skip);
      setCelebrating((current) => current.filter((item) => item.id !== achievementId));
      await load();
      onDataChanged();
      if (!skip) onToast('Отлично! Награда ваша 🎉');
    } catch (err) {
      setSheetError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && rewards.length === 0) return <Spinner label="Загружаем награды…" />;

  return (
    <>
      <section className="card stack">
        <div className="row row--between row--wrap">
          <div>
            <h2 className="card__title">Мои награды</h2>
            <p className="card__hint">Маленькие приятности за закрытые линии и полные карточки.</p>
          </div>
          <button className="btn btn--soft btn--small" type="button" onClick={() => openForm(null)}>
            ➕ Награда
          </button>
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
                  <button className="btn btn--ghost btn--small" type="button" disabled={busy} onClick={() => openForm(reward)}>
                    Изменить
                  </button>
                  <button className="btn btn--ghost btn--small" type="button" disabled={busy} onClick={() => void toggleArchive(reward)}>
                    {reward.isArchived ? 'Вернуть' : 'В архив'}
                  </button>
                  <button className="btn btn--danger btn--small" type="button" disabled={busy} onClick={() => void removeReward(reward)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="row row--between row--wrap">
          <div>
            <h2 className="card__title">Достижения</h2>
            <p className="card__hint">
              {pending.length > 0
                ? `Ожидают награды: ${pending.length}`
                : 'Все достижения обработаны — так держать!'}
            </p>
          </div>
          {pending.length > 0 ? (
            <button className="btn btn--soft btn--small" type="button" onClick={() => setCelebrating(pending)}>
              Выбрать награды
            </button>
          ) : null}
        </div>

        {achievements.length === 0 ? (
          <EmptyState emoji="🏆" title="Достижений ещё нет" hint="Первая закрытая клетка уже принесёт достижение." />
        ) : (
          <div className="list">
            {achievements.map((item) => (
              <div
                key={item.id}
                className={`list__item ${item.status !== AchievementStatus.Suggested ? 'list__item--done' : ''}`}
              >
                <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                  {item.status === AchievementStatus.Rewarded ? '🎉' : item.status === AchievementStatus.Skipped ? '👍' : '🏆'}
                </span>
                <div className="list__item-main">
                  <p className="list__item-title">{item.title}</p>
                  <p className="list__item-meta">{item.description}</p>
                  <p className="list__item-meta">
                    {item.boardTitle} · {new Date(item.unlockedAt).toLocaleDateString('ru-RU')} ·{' '}
                    {STATUS_LABELS[item.status]}
                    {item.rewardTitle ? `: ${item.rewardEmoji ?? '🎁'} ${item.rewardTitle}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {celebrating.length > 0 ? (
        <AchievementSheet
          achievements={celebrating}
          rewards={suggested}
          busy={busy}
          error={sheetError}
          onClose={() => setCelebrating([])}
          onResolve={(id, rewardId, skip) => void resolve(id, rewardId, skip)}
        />
      ) : null}
    </>
  );
}