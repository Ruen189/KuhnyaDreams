import { useState } from 'react';
import type { FormEvent } from 'react';
import type { TaskInput } from '../api';
import type { TaskDto } from '../types';
import { DIFFICULTY_LABELS, PRIORITY_LABELS, TaskDifficulty, TaskPriority } from '../types';
import { ErrorText, Sheet } from './ui';

const EMPTY: TaskInput = {
  title: '',
  notes: '',
  category: 'Общее',
  priority: TaskPriority.Normal,
  difficulty: TaskDifficulty.Medium,
  estimatedMinutes: 30,
  scheduledDate: null,
  startTime: null,
  endTime: null
};

export default function TaskEditorSheet({
  task,
  categories,
  busy,
  error,
  onClose,
  onSubmit
}: {
  task: TaskDto | null;
  categories: string[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: TaskInput) => void;
}) {
  const [form, setForm] = useState<TaskInput>(
    task
      ? {
          title: task.title,
          notes: task.notes ?? '',
          category: task.category,
          priority: task.priority,
          difficulty: task.difficulty,
          estimatedMinutes: task.estimatedMinutes,
          scheduledDate: task.scheduledDate,
          startTime: task.startTime,
          endTime: task.endTime
        }
      : EMPTY
  );

  const patch = (changes: Partial<TaskInput>) => setForm((current) => ({ ...current, ...changes }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...form,
      title: form.title.trim(),
      notes: form.notes?.trim() ? form.notes.trim() : null,
      category: form.category?.trim() ? form.category.trim() : 'Общее',
      scheduledDate: form.scheduledDate || null,
      startTime: form.startTime || null,
      endTime: form.endTime || null
    });
  };

  return (
    <Sheet title={task ? 'Редактировать задачу' : 'Новая задача'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span>Что нужно сделать</span>
          <input
            className="input"
            required
            autoFocus
            value={form.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="Например: 20 минут прогулки"
          />
        </label>

        <label className="field">
          <span>Заметка (необязательно)</span>
          <textarea
            className="textarea"
            value={form.notes ?? ''}
            onChange={(event) => patch({ notes: event.target.value })}
            placeholder="Детали, ссылки, критерии готовности"
          />
        </label>

        <label className="field">
          <span>Категория</span>
          <input
            className="input"
            list="bingo-categories"
            value={form.category ?? ''}
            onChange={(event) => patch({ category: event.target.value })}
            placeholder="Работа, Здоровье, Дом…"
          />
          <datalist id="bingo-categories">
            {categories.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <div className="grid-2">
          <label className="field">
            <span>Приоритет</span>
            <select
              className="select"
              value={form.priority ?? TaskPriority.Normal}
              onChange={(event) => patch({ priority: Number(event.target.value) as TaskPriority })}
            >
              {[TaskPriority.Low, TaskPriority.Normal, TaskPriority.High].map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Сложность</span>
            <select
              className="select"
              value={form.difficulty ?? TaskDifficulty.Medium}
              onChange={(event) => patch({ difficulty: Number(event.target.value) as TaskDifficulty })}
            >
              {[TaskDifficulty.Easy, TaskDifficulty.Medium, TaskDifficulty.Hard].map((value) => (
                <option key={value} value={value}>
                  {DIFFICULTY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Оценка времени, мин</span>
            <input
              className="input"
              type="number"
              min={5}
              max={480}
              step={5}
              value={form.estimatedMinutes ?? 30}
              onChange={(event) => patch({ estimatedMinutes: Number(event.target.value) })}
            />
          </label>

          <label className="field">
            <span>Дата</span>
            <input
              className="input"
              type="date"
              value={form.scheduledDate ?? ''}
              onChange={(event) => patch({ scheduledDate: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Начало</span>
            <input
              className="input"
              type="time"
              value={form.startTime ?? ''}
              onChange={(event) => patch({ startTime: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Окончание</span>
            <input
              className="input"
              type="time"
              value={form.endTime ?? ''}
              onChange={(event) => patch({ endTime: event.target.value })}
            />
          </label>
        </div>

        <ErrorText message={error} />

        <button className="btn btn--block" type="submit" disabled={busy || form.title.trim().length === 0}>
          {busy ? 'Сохраняем…' : task ? 'Сохранить изменения' : 'Добавить задачу'}
        </button>
      </form>
    </Sheet>
  );
}