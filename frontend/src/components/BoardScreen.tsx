import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { BoardInput } from '../api';
import type { AchievementDto, BoardDto, BoardSummaryDto, CellDto, RewardDto, TaskDto, UserDto } from '../types';
import { BoardStatus, PERIOD_LABELS } from '../types';
import { periodRangeLabel, plural } from '../utils/board';
import AchievementSheet from './AchievementSheet';
import CreateBoardSheet from './CreateBoardSheet';
import { EmptyState, ErrorText, ProgressBar, Spinner } from './ui';

interface Props {
  user: UserDto;
  onToast: (message: string) => void;
  onDataChanged: () => void;
}

export default function BoardScreen({ user, onToast, onDataChanged }: Props) {
  const [summaries, setSummaries] = useState<BoardSummaryDto[]>([]);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [board, setBoard] = useState<BoardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<AchievementDto[]>([]);
  const [suggestedRewards, setSuggestedRewards] = useState<RewardDto[]>([]);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const describe = (err: unknown) =>
    err instanceof ApiError ? err.message : 'Не удалось связаться с сервером. Проверьте соединение.';

  const loadBoard = useCallback(
    async (boardId: string) => {
      try {
        setBoard(await api.board(boardId));
      } catch (err) {
        setError(describe(err));
      }
    },
    []
  );

  const load = useCallback(
    async (preferredId?: string) => {
      setLoading(true);
      try {
        const [current, all, taskList] = await Promise.all([
          api.currentBoards(),
          api.boards(),
          api.tasks()
        ]);
        setSummaries(all);
        setTasks(taskList);
        const target = preferredId ?? current[0]?.id ?? all[0]?.id ?? null;
        if (target) {
          setBoard(await api.board(target));
        } else {
          setBoard(null);
        }
        setError(null);
      } catch (err) {
        setError(describe(err));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleCellClick = async (cell: CellDto) => {
    if (!board || busy) return;
    if (cell.isPlaceholder) return;

    if (swapMode) {
      if (!swapSource) {
        setSwapSource(cell.id);
        return;
      }
      if (swapSource === cell.id) {
        setSwapSource(null);
        return;
      }
      setBusy(true);
      try {
        setBoard(await api.swapCells(board.id, swapSource, cell.id));
        setSwapSource(null);
        onToast('Ячейки поменялись местами 🔄');
      } catch (err) {
        setError(describe(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (board.status !== BoardStatus.Active) {
      onToast('Карточка не активна — верните её в игру кнопкой «Вернуть в игру».');
      return;
    }

    setBusy(true);
    try {
      const response = await api.toggleCell(board.id, cell.id);
      setBoard(response.board);
      onDataChanged();
      if (response.newAchievements.length > 0) {
        setCelebrating(response.newAchievements);
        setSuggestedRewards(response.suggestedRewards);
        setSheetError(null);
      } else if (response.previousProgress.hasBingo) {
        onToast('Ячейка снята. Линия больше не закрыта.');
      }
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const createBoard = async (input: BoardInput) => {
    setBusy(true);
    setCreateError(null);
    try {
      const created = await api.createBoard(input);
      setShowCreate(false);
      setSummaries(await api.boards());
      setBoard(created);
      onToast('Карточка собрана — вперёд закрывать клетки! 🎲');
      onDataChanged();
    } catch (err) {
      setCreateError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const resolveAchievement = async (achievementId: string, rewardId: string | null, skip: boolean) => {
    setBusy(true);
    setSheetError(null);
    try {
      await api.resolveAchievement(achievementId, rewardId, skip);
      setCelebrating((current) => {
        const rest = current.filter((item) => item.id !== achievementId);
        if (rest.length === 0) setSuggestedRewards([]);
        return rest;
      });
      if (board) await loadBoard(board.id);
      if (!skip) onToast('Награда закреплена за достижением 🎁');
      onDataChanged();
    } catch (err) {
      setSheetError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const shuffle = async () => {
    if (!board) return;
    setBusy(true);
    try {
      setBoard(await api.shuffleBoard(board.id));
      onToast('Ячейки перемешаны 🎲');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: BoardStatus) => {
    if (!board) return;
    setBusy(true);
    try {
      setBoard(await api.boardStatus(board.id, status));
      setSummaries(await api.boards());
      onToast(status === BoardStatus.Active ? 'Карточка снова в игре ✅' : 'Карточка отправлена в архив 📦');
      onDataChanged();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const removeBoard = async () => {
    if (!board) return;
    if (!window.confirm(`Удалить карточку «${board.title}»? Действие необратимо.`)) return;
    setBusy(true);
    try {
      await api.deleteBoard(board.id);
      setBoard(null);
      await load();
      onToast('Карточка удалена');
      onDataChanged();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Загружаем карточки…" />;

  const cells = board ? [...board.cells].sort((a, b) => a.position - b.position) : [];
  const playable = board?.progress.playableCells ?? 0;

  return (
    <>
      <section className="card stack span-full">
        <div className="row row--between row--wrap">
          <div>
            <h2 className="card__title">{board ? board.title : 'Карточки бинго'}</h2>
            <p className="card__hint">
              {board
                ? `${PERIOD_LABELS[board.period]} · ${periodRangeLabel(board.period, board.startDate, board.endDate)} · поле ${board.size}×${board.size}`
                : 'Соберите карточку из своих задач'}
            </p>
          </div>
          <div className="row row--wrap">
            <button className="btn btn--soft btn--small" type="button" onClick={() => setShowCreate(true)}>
              ➕ Новая карточка
            </button>
          </div>
        </div>

        <ErrorText message={error} />

        {!board ? (
          <EmptyState
            emoji="🎲"
            title="Активной карточки пока нет"
            hint={`${user.displayName}, добавьте задачи и нажмите «Новая карточка» — мы соберём для вас поле 3×3, 4×4 или 5×5.`}
          />
        ) : (
          <>
            <div className="row row--between">
              <span className="small muted">
                Закрыто {board.progress.completedCells} из {playable}{' '}
                {plural(playable, 'клетки', 'клеток', 'клеток')} · {board.progress.percent}%
              </span>
              <span className="small">
                {board.progress.isFullCard
                  ? 'Полная карточка! 🎉'
                  : board.progress.hasBingo
                    ? `Линий собрано: ${board.progress.completedLines}`
                    : `До линии: ${board.progress.cellsToNextLine}`}
              </span>
            </div>
            <ProgressBar value={board.progress.percent} />

            <div className="board" style={{ ['--size' as string]: board.size }}>
              {cells.map((cell) => {
                const classes = ['board__cell'];
                if (cell.isPlaceholder) classes.push('board__cell--placeholder');
                if (cell.isFree) classes.push('board__cell--free');
                if (cell.isCompleted && !cell.isFree) classes.push('board__cell--done');
                if (swapSource === cell.id) classes.push('board__cell--swap-source');

                return (
                  <button
                    key={cell.id}
                    type="button"
                    className={classes.join(' ')}
                    onClick={() => void handleCellClick(cell)}
                    disabled={busy || cell.isPlaceholder}
                    aria-label={cell.isCompleted ? `Снять отметку: ${cell.title}` : `Отметить: ${cell.title}`}
                  >
                    {cell.isFree ? (
                      <span className="board__cell-text">Свободная клетка 🎁</span>
                    ) : (
                      <>
                        <span className="board__cell-text">{cell.title}</span>
                        <span className="board__cell-category">
                          {cell.isCompleted ? '✓ ' : ''}
                          {cell.category ?? ''}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="chips">
              {board.lines.map((line) => (
                <span
                  key={`${line.kind}-${line.index}`}
                  className={`chip ${line.isComplete ? 'chip--success' : line.isActive ? 'chip--warn' : ''}`}
                >
                  {line.kind === 'Row' ? 'ряд' : line.kind === 'Column' ? 'столбец' : 'диагональ'} {line.index + 1}
                  {line.isComplete ? ' ✓' : line.missing > 0 ? ` · ещё ${line.missing}` : ''}
                </span>
              ))}
            </div>

            <div className="row row--wrap">
              <button className="btn btn--ghost btn--small" type="button" disabled={busy} onClick={() => void shuffle()}>
                🎲 Перемешать
              </button>
              <button
                className={`btn ${swapMode ? 'btn--soft' : 'btn--ghost'} btn--small`}
                type="button"
                disabled={busy}
                onClick={() => {
                  setSwapSource(null);
                  setSwapMode((current) => !current);
                }}
              >
                {swapMode ? 'Выберите две клетки…' : '🔄 Поменять клетки'}
              </button>
              {board.status === BoardStatus.Active ? (
                <button
                  className="btn btn--ghost btn--small"
                  type="button"
                  disabled={busy}
                  onClick={() => void changeStatus(BoardStatus.Archived)}
                >
                  📦 В архив
                </button>
              ) : (
                <button
                  className="btn btn--soft btn--small"
                  type="button"
                  disabled={busy}
                  onClick={() => void changeStatus(BoardStatus.Active)}
                >
                  ↩️ Вернуть в игру
                </button>
              )}
              <button className="btn btn--danger btn--small" type="button" disabled={busy} onClick={() => void removeBoard()}>
                🗑 Удалить
              </button>
            </div>
          </>
        )}
      </section>

      {summaries.length > 1 ? (
        <section className="card stack span-full">
          <h2 className="card__title">Мои карточки</h2>
          <p className="card__hint">Нажмите на карточку, чтобы открыть её. Архивные тоже можно смотреть и редактировать.</p>
          <div className="list">
            {summaries.map((item) => {
              const classes = ['list__item'];
              if (item.id === board?.id) classes.push('list__item--done');
              return (
                <button
                  key={item.id}
                  type="button"
                  className={classes.join(' ')}
                  style={{ textAlign: 'left' }}
                  onClick={() => {
                    setSwapMode(false);
                    setSwapSource(null);
                    void loadBoard(item.id);
                  }}
                >
                  <span className="list__item-main">
                    <span className="list__item-title">
                      {item.id === board?.id ? '▶ ' : ''}
                      {item.title}
                    </span>
                    <span className="list__item-meta">
                      {PERIOD_LABELS[item.period]} · {periodRangeLabel(item.period, item.startDate, item.endDate)} ·{' '}
                      {item.completedCells}/{item.playableCells} клеток ({item.percent}%)
                      {item.hasBingo ? ' · БИНГО 🎉' : ''}
                      {item.status === BoardStatus.Archived ? ' · архив' : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {showCreate ? (
        <CreateBoardSheet
          tasks={tasks}
          busy={busy}
          error={createError}
          onClose={() => setShowCreate(false)}
          onCreate={(input) => void createBoard(input)}
        />
      ) : null}

      {celebrating.length > 0 ? (
        <AchievementSheet
          achievements={celebrating}
          rewards={suggestedRewards}
          busy={busy}
          error={sheetError}
          onClose={() => {
            setCelebrating([]);
            setSuggestedRewards([]);
          }}
          onResolve={(id, rewardId, skip) => void resolveAchievement(id, rewardId, skip)}
        />
      ) : null}
    </>
  );
}