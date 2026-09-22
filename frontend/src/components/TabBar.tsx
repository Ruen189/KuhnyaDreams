export type Tab = 'board' | 'tasks' | 'rewards' | 'stats' | 'settings';

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'board', emoji: '🎲', label: 'Карточка' },
  { id: 'tasks', emoji: '✅', label: 'Задачи' },
  { id: 'rewards', emoji: '🎁', label: 'Награды' },
  { id: 'stats', emoji: '📊', label: 'Статистика' },
  { id: 'settings', emoji: '⚙️', label: 'Настройки' }
];

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Основная навигация">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`tabbar__item ${tab === item.id ? 'tabbar__item--active' : ''}`}
          aria-current={tab === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          <span aria-hidden="true">{item.emoji}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}