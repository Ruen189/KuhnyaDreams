import type { NotificationDto } from '../types';
import { NOTIFICATION_ICONS } from '../types';
import { EmptyState, Sheet } from './ui';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function NotificationsPanel({
  items,
  unreadCount,
  onClose,
  onRead,
  onReadAll,
  onClear
}: {
  items: NotificationDto[];
  unreadCount: number;
  onClose: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onClear: () => void;
}) {
  return (
    <Sheet title="Уведомления" onClose={onClose}>
      <div className="stack">
        <div className="row row--between">
          <span className="small muted">
            {unreadCount > 0 ? `Непрочитанных: ${unreadCount}` : 'Всё прочитано'}
          </span>
          <div className="row">
            <button type="button" className="btn btn--soft btn--small" onClick={onReadAll} disabled={unreadCount === 0}>
              Прочитать все
            </button>
            <button type="button" className="btn btn--danger btn--small" onClick={onClear} disabled={items.length === 0}>
              Очистить
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState emoji="📭" title="Пока пусто" hint="Здесь появятся напоминания, прогресс и достижения." />
        ) : (
          <div className="list">
            {items.map((item) => (
              <div
                key={item.id}
                className={`list__item ${item.readAt ? 'list__item--done' : ''}`}
                onClick={() => (item.readAt ? undefined : onRead(item.id))}
              >
                <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                  {NOTIFICATION_ICONS[item.type] ?? 'ℹ️'}
                </span>
                <div className="list__item-main">
                  <p className="list__item-title">{item.title}</p>
                  <p className="list__item-meta">{item.body}</p>
                  <p className="list__item-meta">
                    {formatDateTime(item.createdAt)}
                    {item.sentToTelegram ? ' · отправлено в Telegram' : ''}
                    {item.readAt ? '' : ' · непрочитано'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}