export type Tab = 'board' | 'tasks' | 'rewards' | 'stats' | 'settings';

// Карточка стоит в центре панели — это главный экран, он же открывается сразу после входа.
const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'tasks', emoji: '✅', label: 'Задачи' },
  { id: 'rewards', emoji: '🎁', label: 'Награды' },
  { id: 'board', emoji: '🎲', label: 'Карточка' },
  { id: 'stats', emoji: '📊', label: 'Статистика' },
  { id: 'settings', emoji: '⚙️', label: 'Настройки' }
];

const PRIMARY_TAB: Tab = 'board';

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Основная навигация">
      {TABS.map((item) => {
        const classes = ['tabbar__item'];
        if (tab === item.id) classes.push('tabbar__item--active');
        if (item.id === PRIMARY_TAB) classes.push('tabbar__item--primary');

        return (
          <button
            key={item.id}
            type="button"
            className={classes.join(' ')}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => onChange(item.id)}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}