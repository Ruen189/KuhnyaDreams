import type { ReactNode } from 'react';

export function Sheet({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row row--between" style={{ marginBottom: 12 }}>
          <h2 className="card__title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__value" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function StatTile({ value, label, emoji }: { value: ReactNode; label: string; emoji?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile__value">
        {emoji ? `${emoji} ` : ''}
        {value}
      </div>
      <div className="stat-tile__label">{label}</div>
    </div>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="error-text">{message}</p>;
}

export function Switch({
  label,
  checked,
  hint,
  onChange
}: {
  label: string;
  checked: boolean;
  hint?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="switch">
      <span>
        {label}
        {hint ? (
          <>
            <br />
            <span className="tiny muted">{hint}</span>
          </>
        ) : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function Spinner({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <p className="muted small center" role="status">
      {label}
    </p>
  );
}

export function EmptyState({ emoji, title, hint }: { emoji: string; title: string; hint?: string }) {
  return (
    <div className="center stack">
      <div style={{ fontSize: '2rem' }}>{emoji}</div>
      <strong>{title}</strong>
      {hint ? <span className="muted small">{hint}</span> : null}
    </div>
  );
}