import { BoardPeriod, BoardStatus } from '../types';

/** Повторяет логику BoardFactory.AutoSize на бэкенде: минимальный подходящий квадрат 3x3..5x5. */
export function autoSize(taskCount: number): number {
  for (let size = 3; size <= 5; size++) {
    const diff = size * size - taskCount;
    if (diff >= 0 && diff <= 2) return size;
  }
  for (let size = 3; size <= 5; size++) {
    if (size * size >= taskCount) return size;
  }
  return 5;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function periodRangeLabel(period: BoardPeriod, start: string, end: string): string {
  const from = formatShortDate(start);
  const to = formatShortDate(end);
  if (period === BoardPeriod.Day || from === to) return from;
  return `${from} — ${to}`;
}

export function statusLabel(status: BoardStatus): string {
  switch (status) {
    case BoardStatus.Active:
      return 'Активная';
    case BoardStatus.Completed:
      return 'Карточка закрыта';
    default:
      return 'В архиве';
  }
}

export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Название линии карточки. Бэкенд отдаёт вид линии в нижнем регистре
 * (`row`, `col`, `diag`, `anti-diag`) — диагоналей всегда две: ↘ (1→последний) и ↙ (зеркальная).
 */
export function lineLabel(kind: string, index: number): string {
  switch (kind.toLowerCase()) {
    case 'row':
      return `ряд ${index + 1}`;
    case 'col':
      return `столбец ${index + 1}`;
    case 'diag':
      return 'диагональ ↘';
    default:
      return 'диагональ ↙';
  }
}

/** Сколько всего линий на поле: ряды + столбцы + две диагонали. */
export function linesTotal(size: number): number {
  return size * 2 + 2;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}