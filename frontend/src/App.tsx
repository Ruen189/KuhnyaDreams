import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import BoardScreen from './components/BoardScreen';
import CupsSheet from './components/CupsSheet';
import LoginScreen from './components/LoginScreen';
import NotificationsPanel from './components/NotificationsPanel';
import RewardsScreen from './components/RewardsScreen';
import SettingsScreen from './components/SettingsScreen';
import StatsScreen from './components/StatsScreen';
import TabBar from './components/TabBar';
import type { Tab } from './components/TabBar';
import TasksScreen from './components/TasksScreen';
import { Spinner, Toast } from './components/ui';
import { clearSession, getStoredUser, getToken, saveUser } from './session';
import type { AchievementDto, NotificationDto, UserDto } from './types';

const TAB_TITLES: Record<Tab, string> = {
  board: 'Карточка бинго',
  tasks: 'Задачи',
  rewards: 'Награды',
  stats: 'Статистика',
  settings: 'Настройки'
};

export default function App() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [tab, setTab] = useState<Tab>('board');
  const [toast, setToast] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCups, setShowCups] = useState(false);
  const [cupHistory, setCupHistory] = useState<AchievementDto[]>([]);

  const notify = useCallback((message: string) => setToast(message), []);

  const refreshUser = useCallback(async () => {
    try {
      const fresh = await api.me();
      setUser(fresh);
      saveUser(fresh);
    } catch {
      /* баланс кубков обновится при следующем заходе */
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const refreshNotifications = useCallback(async () => {
    try {
      const feed = await api.notifications(30);
      setNotifications(feed.items);
      setUnread(feed.unreadCount);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setNotifications([]);
        setUnread(0);
      }
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setRestoring(false);
      return;
    }

    const cached = getStoredUser();
    if (cached) setUser(cached);

    void (async () => {
      try {
        const fresh = await api.me();
        setUser(fresh);
        saveUser(fresh);
      } catch {
        clearSession();
        setUser(null);
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (user) void refreshNotifications();
  }, [user, refreshNotifications]);

  const handleAuthed = (authed: UserDto) => {
    setUser(authed);
    setTab('board');
    notify(`Привет, ${authed.displayName}! Готовы закрывать клетки? 🎲`);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setNotifications([]);
    setUnread(0);
    setShowNotifications(false);
    setTab('board');
  };

  const markRead = async (id: string) => {
    try {
      await api.readNotification(id);
      await refreshNotifications();
    } catch {
      /* лента обновится при следующем запросе */
    }
  };

  const markAllRead = async () => {
    try {
      await api.readAllNotifications();
      await refreshNotifications();
    } catch {
      notify('Не удалось отметить уведомления прочитанными');
    }
  };

  const clearNotifications = async () => {
    try {
      await api.clearNotifications();
      await refreshNotifications();
      notify('Лента очищена');
    } catch {
      notify('Не удалось очистить ленту');
    }
  };

  // Любое изменение данных (клетка, награда, задача) обновляет ленту и счётчик кубков.
  const handleDataChanged = useCallback(() => {
    void refreshNotifications();
    void refreshUser();
  }, [refreshNotifications, refreshUser]);

  const openCups = async () => {
    setShowCups(true);
    try {
      setCupHistory(await api.achievements());
    } catch {
      setCupHistory([]);
    }
  };

  if (restoring) return <Spinner label="Открываем вашу карточку…" />;
  if (!user) return <LoginScreen onAuthed={handleAuthed} />;

  const cups = user.cups ?? 0;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">{TAB_TITLES[tab]}</h1>
        <div className="app__header-actions">
          <button
            type="button"
            className="icon-btn icon-btn--cups"
            aria-label={`Кубки: свободно ${cups}. Нажмите, чтобы узнать, за что они начислены.`}
            onClick={() => void openCups()}
          >
            <span aria-hidden="true">🏆</span>
            {cups > 0 ? <span className="icon-btn__count">{cups > 99 ? '99+' : cups}</span> : null}
          </button>
        </div>
      </header>

      <main className="app__main">
        {tab === 'board' ? (
          <BoardScreen user={user} onToast={notify} onDataChanged={handleDataChanged} />
        ) : null}
        {tab === 'tasks' ? <TasksScreen onToast={notify} onDataChanged={handleDataChanged} /> : null}
        {tab === 'rewards' ? (
          <RewardsScreen
            user={user}
            onUser={(updated) => {
              setUser(updated);
              saveUser(updated);
            }}
            onToast={notify}
            onDataChanged={handleDataChanged}
          />
        ) : null}
        {tab === 'stats' ? <StatsScreen /> : null}
        {tab === 'settings' ? (
          <SettingsScreen
            user={user}
            onUser={(updated) => {
              setUser(updated);
              saveUser(updated);
            }}
            onToast={notify}
            onLogout={handleLogout}
            unreadCount={unread}
            onOpenNotifications={() => setShowNotifications(true)}
          />
        ) : null}
      </main>

      <TabBar tab={tab} onChange={setTab} />

      <Toast message={toast} />

      {showNotifications ? (
        <NotificationsPanel
          items={notifications}
          unreadCount={unread}
          onClose={() => setShowNotifications(false)}
          onRead={(id) => void markRead(id)}
          onReadAll={() => void markAllRead()}
          onClear={() => void clearNotifications()}
        />
      ) : null}

      {showCups ? (
        <CupsSheet
          achievements={cupHistory}
          available={cups}
          spent={user.cupsSpent ?? 0}
          onClose={() => setShowCups(false)}
        />
      ) : null}
    </div>
  );
}