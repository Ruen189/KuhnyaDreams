import { useCallback, useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { api, ApiError } from '../api';
import type { BoardInput } from '../api';
import type { AchievementDto, BoardDto, BoardSummaryDto, CellDto, RewardDto, TaskDto, UserDto } from '../types';
import { BoardStatus } from '../types';
import { plural } from '../utils/board';
import AchievementSheet from './AchievementSheet';
import BoardHistorySheet from './BoardHistorySheet';
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
  const [celebrating, setCelebrating] = useState<AchievementDto[]>([]);
  const [suggestedRewards, setSuggestedRewards] = useState<RewardDto[]>([]);
  const [sheetError, setSheetError] = useState<string | null>(null);
  // Режим перемещения: зажал клетку — перетащил на другую.
  const [moveMode, setMoveMode] = useState(false);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  // Подробности по карточке из истории.
  const [historySummary, setHistorySummary] = useState<BoardSummaryDto | null>(null);

  const describe = (err: unknown) =>
    err instanceof ApiError ? err.message : 'Не удалось связаться с сервером. Проверьте соединение.';

  const loadBoard = useCallback(async (boardId: string) => {
    try {
      setBoard(await api.board(boardId));
    } catch (err) {
      setError(describe(err));
    }
  }, []);

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true);
    try {
      const [current, all, taskList] = await Promise.all([api.currentBoards(), api.boards(), api.tasks()]);
      setSummaries(all);
      setTasks(taskList);
      const target = preferredId ?? current[0]?.id ?? all[0]?.id ?? null;
      setBoard(target ? await api.board(target) : null);
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

  const handleCellClick = async (cell: CellDto) => {
    if (!board || busy || moveMode || cell.isPlaceholder) return;

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

  // ---------------------------------------------------------------- перемещение клеток
  const handlePointerDown = (cell: CellDto, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!moveMode || busy || !board) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragFrom(cell.id);
    setDragOver(cell.id);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragFrom) return;
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell-id]');
    const id = under?.dataset.cellId;
    if (id && id !== dragOver) setDragOver(id);
  };

  const finishDrag = async () => {
    const source = dragFrom;
    const target = dragOver;
    setDragFrom(null);
    setDragOver(null);
    if (!source || !target || source === target || !board) return;

    const order = [...board.cells].sort((a, b) => a.position - b.position).map((cell) => cell.id);
    const from = order.indexOf(source);
    const to = order.indexOf(target);
    if (from < 0 || to < 0) return;

    order.splice(to, 0, ...order.splice(from, 1));

    setBusy(true);
    try {
      setBoard(await api.reorderBoard(board.id, order));
      onToast('Клетки переставлены 🔄');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const cancelDrag = () => {
    setDragFrom(null);
    setDragOver(null);
  };

  const toggleMoveMode = () => {
    cancelDrag();
    setMoveMode((current) => !current);
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
          <h2 className="card__title">{board ? board.title : 'Карточки бинго'}</h2>
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

            <div
              className={`board ${moveMode ? 'board--moving' : ''}`}
              style={{ ['--size' as string]: board.size }}
            >
              {cells.map((cell) => {
                const classes = ['board__cell'];
                if (cell.isPlaceholder) classes.push('board__cell--placeholder');
                if (cell.isFree) classes.push('board__cell--free');
                if (cell.isCompleted && !cell.isFree) classes.push('board__cell--done');
                if (dragFrom === cell.id) classes.push('board__cell--dragging');
                if (dragFrom && dragOver === cell.id && dragFrom !== cell.id) classes.push('board__cell--drop-target');

                return (
                  <button
                    key={cell.id}
                    type="button"
                    data-cell-id={cell.id}
                    className={classes.join(' ')}
                    onClick={() => void handleCellClick(cell)}
                    onPointerDown={(event) => handlePointerDown(cell, event)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => void finishDrag()}
                    onPointerCancel={cancelDrag}
                    disabled={busy || (cell.isPlaceholder && !moveMode)}
                    aria-label={
                      moveMode
                        ? `Переместить: ${cell.title}`
                        : cell.isCompleted
                          ? `Снять отметку: ${cell.title}`
                          : `Отметить: ${cell.title}`
                    }
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

            {moveMode ? (
              <p className="card__hint">
                ✋ Зажмите клетку и перетащите её на другую — задача встанет на новое место. Нажмите «✅ Готово», чтобы
                вернуться к игре.
              </p>
            ) : null}
<div className="row row--wrap">
              <button
                className={`btn ${moveMode ? 'btn--move-on' : 'btn--ghost'} btn--small`}
                type="button"
                disabled={busy}
                aria-pressed={moveMode}
                onClick={toggleMoveMode}
              >
                {moveMode ? '✅ Готово' : '✋ Перемещать'}
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

              <button
                className="btn btn--danger btn--small"
                type="button"
                disabled={busy}
                onClick={() => void removeBoard()}
              >
                🗑 Удалить
              </button>
            </div>
          </>
        )}
      </section>

      {summaries.length > 0 ? (
        <section className="card stack span-full">
          <h2 className="card__title">История карточек</h2>
          <div className="list">
            {summaries.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`list__item list__item--tap ${item.id === board?.id ? 'list__item--current' : ''}`}
                onClick={() => setHistorySummary(item)}
              >
                <span className="list__item-main">
                  <span className="list__item-title">
                    {item.id === board?.id ? '▶ ' : ''}
                    {item.title}
                  </span>
                </span>
                <span aria-hidden="true" className="muted">
                  ›
                </span>
              </button>
            ))}
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

      {historySummary ? (
        <BoardHistorySheet
          summary={historySummary}
          onClose={() => setHistorySummary(null)}
          onOpen={(boardId) => {
            setHistorySummary(null);
            setMoveMode(false);
            void loadBoard(boardId);
          }}
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