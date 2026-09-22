import { useState } from 'react';
import type { BoardInput } from '../api';
import type { TaskDto } from '../types';
import { BoardPeriod, PRIORITY_LABELS } from '../types';
import { autoSize, plural } from '../utils/board';
import { ErrorText, Sheet } from './ui';

export default function CreateBoardSheet({
  tasks,
  busy,
  error,
  onClose,
  onCreate
}: {
  tasks: TaskDto[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: BoardInput) => void;
}) {
  const active = tasks.filter((task) => !task.isArchived);
  const [period, setPeriod] = useState<BoardPeriod>(BoardPeriod.Day);
  const [size, setSize] = useState<string>('auto');
  const [shuffle, setShuffle] = useState(true);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>(active.map((task) => task.id));

  const toggleTask = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const count = selected.length;
  const previewSize = size === 'auto' ? (count > 0 ? autoSize(count) : 3) : Number(size);
  const fits = count <= previewSize * previewSize;

  const submit = () => {
    onCreate({
      title: title.trim() || null,
      period,
      startDate: null,
      size: size === 'auto' ? null : Number(size),
      taskIds: count > 0 && count < active.length ? selected : null,
      shuffle,
      useAllActiveTasks: count === active.length
    });
  };

  return (
    <Sheet title="Новая карточка" onClose={onClose}>
      <div className="stack">
        <label className="field">
          <span>Название (необязательно)</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Бинго на выходные"
          />
        </label>

        <div className="grid-2">
          <label className="field">
            <span>Период</span>
            <select className="select" value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
              <option value={BoardPeriod.Day}>День</option>
              <option value={BoardPeriod.Week}>Неделя</option>
              <option value={BoardPeriod.Month}>Месяц</option>
            </select>
          </label>

          <label className="field">
            <span>Размер поля</span>
            <select className="select" value={size} onChange={(event) => setSize(event.target.value)}>
              <option value="auto">Автоматически ({previewSize}×{previewSize})</option>
              <option value="3">3 × 3</option>
              <option value="4">4 × 4</option>
              <option value="5">5 × 5</option>
            </select>
          </label>
        </div>

        <label className="switch">
          <span>
            Перемешивать задачи
            <br />
            <span className="tiny muted">Каждая карточка будет выглядеть по-новому</span>
          </span>
          <input type="checkbox" checked={shuffle} onChange={(event) => setShuffle(event.target.checked)} />
        </label>

        <div className="stack">
          <div className="row row--between">
            <strong className="small">Задачи для карточки</strong>
            <span className="tiny muted">
              {count} из {active.length} · {plural(count, 'задача', 'задачи', 'задач')}
            </span>
          </div>

          {active.length === 0 ? (
            <p className="card__hint">Сначала добавьте хотя бы одну задачу на вкладке «Задачи».</p>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setSelected(active.map((t) => t.id))}>
                Выбрать все
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setSelected([])}>
                Снять выбор
              </button>
            </div>
          )}

          <div className="list" style={{ maxHeight: 260, overflowY: 'auto' }}>
            {active.map((task) => (
              <label key={task.id} className="list__item" style={{ alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(task.id)}
                  onChange={() => toggleTask(task.id)}
                  style={{ width: 22, height: 22, accentColor: '#7c5cff' }}
                />
                <span className="list__item-main">
                  <span className="list__item-title">{task.title}</span>
                  <span className="list__item-meta">
                    {task.category} · {PRIORITY_LABELS[task.priority]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {!fits ? (
          <p className="error-text">
            В поле {previewSize}×{previewSize} помещается {previewSize * previewSize} задач — уберите лишние или выберите размер больше.
          </p>
        ) : null}

        <ErrorText message={error} />

        <button className="btn btn--block" type="button" disabled={busy || count === 0 || !fits} onClick={submit}>
          {busy ? 'Собираем карточку…' : 'Собрать карточку'}
        </button>
      </div>
    </Sheet>
  );
}