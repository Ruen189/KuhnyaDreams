import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { BoardDto, BoardSummaryDto } from '../types';
import { BoardStatus, PERIOD_LABELS } from '../types';
import { formatDateTime, lineLabel, linesTotal, periodRangeLabel, plural, statusLabel } from '../utils/board';
import { ErrorText, ProgressBar, Sheet, Spinner, StatTile } from './ui';

/**
 * Подробности по карточке из истории: что было закрыто, какие линии собраны,
 * какие достижения получены и какие награды за них выбраны.
 */
export default function BoardHistorySheet({
  summary,
  onClose,
  onOpen
}: {
  summary: BoardSummaryDto;
  onClose: () => void;
  onOpen: (boardId: string) => void;
}) {
  const [board, setBoard] = useState<BoardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const full = await api.board(summary.id);
        if (alive) {
          setBoard(full);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : 'Не удалось загрузить карточку.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [summary.id]);

  const cells = board ? [...board.cells].sort((a, b) => a.position - b.position) : [];
  const doneTasks = cells.filter((cell) => cell.isCompleted && !cell.isFree && !cell.isPlaceholder);
  const completeLines = board?.lines.filter((line) => line.isComplete) ?? [];

  return (
    <Sheet title={summary.title} onClose={onClose}>
      <div className="stack">
        <p className="card__hint">
          {PERIOD_LABELS[summary.period]} · {periodRangeLabel(summary.period, summary.startDate, summary.endDate)} ·{' '}
          {statusLabel(summary.status)}
          {summary.completedAt ? ` · закрыта ${formatDateTime(summary.completedAt)}` : ''}
        </p>

        <ErrorText message={error} />

        {loading && !board ? (
          <Spinner label="Открываем карточку…" />
        ) : board ? (
          <>
            <ProgressBar value={board.progress.percent} />

            <div className="grid-2">
              <StatTile
                emoji="✅"
                value={`${board.progress.completedCells}/${board.progress.playableCells}`}
                label="клеток закрыто"
              />
              <StatTile
                emoji="📏"
                value={`${board.progress.completedLines}/${linesTotal(board.size)}`}
                label="линий собрано"
              />
              <StatTile
                emoji={board.progress.isFullCard ? '🎉' : board.progress.hasBingo ? '🔥' : '🎲'}
                value={`${board.progress.percent}%`}
                label={
                  board.progress.isFullCard ? 'полная карточка' : board.progress.hasBingo ? 'есть бинго' : 'прогресс'
                }
              />
              <StatTile emoji="🏆" value={board.achievements.length} label="достижений" />
            </div>

            <div className="board board--readonly" style={{ ['--size' as string]: board.size }}>
              {cells.map((cell) => (
                <div
                  key={cell.id}
                  className={`board__cell board__cell--static ${
                    cell.isPlaceholder ? 'board__cell--placeholder' : ''
                  } ${cell.isFree ? 'board__cell--free' : ''} ${
                    cell.isCompleted && !cell.isFree ? 'board__cell--done' : ''
                  }`}
                >
                  <span className="board__cell-text">{cell.isFree ? 'Свободная клетка 🎁' : cell.title}</span>
                  <span className="board__cell-category">
                    {cell.isCompleted && cell.completedAt ? formatDateTime(cell.completedAt) : (cell.category ?? '')}
                  </span>
                </div>
              ))}
            </div>

<div className="stack">
              <strong className="small">
                Линии на поле: {completeLines.length} из {board.lines.length}
              </strong>
              <div className="chips">
                {board.lines.map((line) => (
                  <span
                    key={`${line.kind}-${line.index}`}
                    className={`chip ${line.isComplete ? 'chip--success' : line.isActive ? 'chip--warn' : ''}`}
                  >
                    {lineLabel(line.kind, line.index)}
                    {line.isComplete ? ' ✓' : line.missing > 0 ? ` · ещё ${line.missing}` : ''}
                  </span>
                ))}
              </div>
              <span className="tiny muted">
                Диагоналей всегда две: ↘ от первой клетки к последней (1, 5, 9, …) и ↙ зеркальная (3, 5, 7, …).
              </span>
            </div>

            <div className="stack">
              <strong className="small">
                Закрытые задачи: {doneTasks.length} {plural(doneTasks.length, 'задача', 'задачи', 'задач')}
              </strong>
              {doneTasks.length === 0 ? (
                <span className="tiny muted">За этот период ни одна задача не была закрыта.</span>
              ) : (
                <div className="list">
                  {doneTasks.map((cell) => (
                    <div key={cell.id} className="list__item list__item--done">
                      <span className="list__item-main">
                        <span className="list__item-title">✓ {cell.title}</span>
                        <span className="list__item-meta">
                          {cell.category ?? 'Без категории'} · {formatDateTime(cell.completedAt)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {board.achievements.length > 0 ? (
              <div className="stack">
                <strong className="small">Достижения</strong>
                <div className="list">
                  {board.achievements.map((achievement) => (
                    <div key={achievement.id} className="list__item">
                      <span className="list__item-main">
                        <span className="list__item-title">{achievement.title}</span>
                        <span className="list__item-meta">
                          {formatDateTime(achievement.unlockedAt)}
                          {achievement.rewardTitle
                            ? ` · награда: ${achievement.rewardEmoji ?? '🎁'} ${achievement.rewardTitle}`
                            : ' · без награды'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="row row--wrap">
              <button className="btn btn--soft btn--small" type="button" onClick={() => onOpen(summary.id)}>
                ▶ Открыть в карточке
              </button>
              {summary.status === BoardStatus.Active ? null : (
                <span className="tiny muted">Карточка закрыта — на вкладке «Карточка» её можно вернуть в игру.</span>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}