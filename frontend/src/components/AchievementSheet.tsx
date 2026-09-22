import { useState } from 'react';
import type { AchievementDto, RewardDto } from '../types';
import { AchievementKind } from '../types';
import { ErrorText, Sheet } from './ui';

const KIND_EMOJI: Record<AchievementKind, string> = {
  [AchievementKind.FirstCell]: '👣',
  [AchievementKind.Line]: '📏',
  [AchievementKind.TwoLines]: '✌️',
  [AchievementKind.HalfCard]: '⚡',
  [AchievementKind.AlmostFull]: '🔥',
  [AchievementKind.FullCard]: '🎉'
};

export default function AchievementSheet({
  achievements,
  rewards,
  busy,
  error,
  onClose,
  onResolve
}: {
  achievements: AchievementDto[];
  rewards: RewardDto[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onResolve: (achievementId: string, rewardId: string | null, skip: boolean) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState(achievements[0]?.id ?? '');
  const active = achievements.find((item) => item.id === activeId) ?? achievements[0];
  const isBingo = active?.kind === AchievementKind.FullCard;

  return (
    <Sheet title={isBingo ? 'БИНГО! 🎊' : 'Новое достижение'} onClose={onClose}>
      <div className="stack">
        <p className="celebration" aria-hidden="true">
          {active ? KIND_EMOJI[active.kind] : '🏆'}
        </p>

        <div className="chips">
          {achievements.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${item.id === active?.id ? 'chip--warn' : ''}`}
              onClick={() => setActiveId(item.id)}
            >
              {KIND_EMOJI[item.kind]} {item.title}
            </button>
          ))}
        </div>

        {active ? (
          <div className="card card--flat stack">
            <strong>{active.title}</strong>
            <p className="card__hint">{active.description}</p>
            <span className="tiny muted">Карточка: {active.boardTitle}</span>
          </div>
        ) : null}

        <strong className="small">Выбери награду за успех</strong>

        {rewards.length === 0 ? (
          <p className="card__hint">
            Награды ещё не добавлены. Загляните на вкладку «Награды», чтобы создать свою — или пропустите этот шаг.
          </p>
        ) : (
          <div className="stack">
            {rewards.map((reward) => {
              const chosen = active ? selected[active.id] === reward.id : false;
              return (
                <button
                  key={reward.id}
                  type="button"
                  className={`reward-option ${chosen ? 'reward-option--selected' : ''}`}
                  onClick={() => active && setSelected((current) => ({ ...current, [active.id]: reward.id }))}
                >
                  <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
                    {reward.emoji || '🎁'}
                  </span>
                  <span>
                    <strong>{reward.title}</strong>
                    {reward.description ? <span className="list__item-meta">{reward.description}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <ErrorText message={error} />

        <div className="row">
          <button
            className="btn btn--block"
            type="button"
            disabled={busy || !active || !selected[active.id]}
            onClick={() => active && onResolve(active.id, selected[active.id], false)}
          >
            {busy ? 'Сохраняем…' : 'Забрать награду'}
          </button>
          <button
            className="btn btn--ghost btn--block"
            type="button"
            disabled={busy || !active}
            onClick={() => active && onResolve(active.id, null, true)}
          >
            Пропустить
          </button>
        </div>
      </div>
    </Sheet>
  );
}