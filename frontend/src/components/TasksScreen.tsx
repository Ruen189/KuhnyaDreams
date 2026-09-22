import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import type { TaskInput } from '../api';
import type { TaskDto } from '../types';
import { DIFFICULTY_LABELS, PRIORITY_LABELS, TaskPriority } from '../types';
import { formatDate } from '../utils/board';
import TaskEditorSheet from './TaskEditorSheet';
import { EmptyState, ErrorText, Sheet, Spinner } from './ui';

export default function TasksScreen({
  onToast,
  onDataChanged
}: {
  onToast: (message: string) => void;
  onDataChanged: () => void;
}) {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskDto | null | 'new'>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const describe = (err: unknown) =>
    err instanceof ApiError ? err.message : 'Не удалось связаться с сервером. Проверьте соединение.';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cats] = await Promise.all([api.tasks(includeArchived), api.taskCategories()]);
      setTasks(list);
      setCategories(cats);
      setError(null);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (category && task.category !== category) return false;
      if (!needle) return true;
      return (
        task.title.toLowerCase().includes(needle) ||
        (task.notes ?? '').toLowerCase().includes(needle) ||
        task.category.toLowerCase().includes(needle)
      );
    });
  }, [tasks, search, category]);

  const save = async (input: TaskInput) => {
    setBusy(true);
    setSheetError(null);
    try {
      if (editing && editing !== 'new') {
        await api.updateTask(editing.id, input);
        onToast('Задача обновлена ✏️');
      } else {
        await api.createTask(input);
        onToast('Задача добавлена ✅');
      }
      setEditing(null);
      await load();
      onDataChanged();
    } catch (err) {
      setSheetError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async (task: TaskDto) => {
    setBusy(true);
    try {
      await api.archiveTask(task.id, !task.isArchived);
      await load();
      onDataChanged();
      onToast(task.isArchived ? 'Задача вернулась в список' : 'Задача в архиве 📦');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (task: TaskDto) => {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setBusy(true);
    try {
      await api.deleteTask(task.id);
      await load();
      onDataChanged();
      onToast('Задача удалена');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const addBulk = async () => {
    const lines = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      onToast('Добавьте хотя бы одну строку');
      return;
    }

    setBusy(true);
    try {
      const created = await api.createTasksBulk(lines.map((title) => ({ title, category: 'Общее' })));
      setBulkText('');
      setShowBulk(false);
      await load();
      onDataChanged();
      onToast(`Добавлено задач: ${created.length} ✅`);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && tasks.length === 0) return <Spinner label="Загружаем задачи…" />;

  return (
    <>
      <section className="card stack">
        <div className="row row--between row--wrap">
          <div>
            <h2 className="card__title">Мои задачи</h2>
            <p className="card__hint">
              {visible.length} из {tasks.length} в списке. Из активных задач собирается карточка бинго.
            </p>
          </div>
          <div className="row row--wrap">
            <button className="btn btn--ghost btn--small" type="button" onClick={() => setShowBulk(true)}>
              📋 Списком
            </button>
            <button className="btn btn--soft btn--small" type="button" onClick={() => setEditing('new')}>
              ➕ Задача
            </button>
          </div>
        </div>

        <div className="grid-2">
          <label className="field">
            <span>Поиск</span>
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Название, заметка, категория"
            />
          </label>
          <label className="field">
            <span>Категория</span>
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Все категории</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="switch">
          <span>Показывать архив</span>
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
        </label>

        <ErrorText message={error} />

        {visible.length === 0 ? (
          <EmptyState
            emoji="🗒"
            title="Задач нет"
            hint="Добавьте первую задачу — из них мы соберём карточку бинго."
          />
        ) : (
          <div className="list">
            {visible.map((task) => (
              <div key={task.id} className={`list__item ${task.isArchived ? 'list__item--done' : ''}`}>
                <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                  {task.priority === TaskPriority.High ? '🔥' : task.isArchived ? '📦' : '✅'}
                </span>
                <div className="list__item-main">
                  <p className="list__item-title">{task.title}</p>
                  <p className="list__item-meta">
                    {task.category} · {PRIORITY_LABELS[task.priority]} · {DIFFICULTY_LABELS[task.difficulty]} ·{' '}
                    {task.estimatedMinutes} мин
                  </p>
                  <p className="list__item-meta">
                    {task.scheduledDate ? `на ${formatDate(task.scheduledDate)}` : 'без даты'}
                    {task.startTime ? ` · ${task.startTime.slice(0, 5)}` : ''}
                    {task.endTime ? `–${task.endTime.slice(0, 5)}` : ''}
                  </p>
                  {task.notes ? <p className="list__item-meta">{task.notes}</p> : null}
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <button
                    className="btn btn--ghost btn--small"
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing(task)}
                  >
                    Изменить
                  </button>
                  <button
                    className="btn btn--ghost btn--small"
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleArchive(task)}
                  >
                    {task.isArchived ? 'Вернуть' : 'В архив'}
                  </button>
                  <button
                    className="btn btn--danger btn--small"
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(task)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editing !== null ? (
        <TaskEditorSheet
          task={editing === 'new' ? null : editing}
          categories={categories}
          busy={busy}
          error={sheetError}
          onClose={() => {
            setEditing(null);
            setSheetError(null);
          }}
          onSubmit={(input) => void save(input)}
        />
      ) : null}

      {showBulk ? (
        <Sheet title="Добавить списком" onClose={() => setShowBulk(false)}>
          <div className="stack">
            <p className="card__hint">Каждая строка — отдельная задача. Все попадут в категорию «Общее».</p>
            <textarea
              className="textarea"
              rows={8}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={'Позвонить родителям\nРазобрать почту\n30 минут спорта'}
            />
            <button className="btn btn--block" type="button" disabled={busy} onClick={() => void addBulk()}>
              {busy ? 'Добавляем…' : 'Добавить все'}
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}