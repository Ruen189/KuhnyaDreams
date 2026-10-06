import type { UserDto } from './types';

const TOKEN_KEY = 'bingo.token';
const USER_KEY = 'bingo.user';
const THEME_KEY = 'bingo.theme';

export type Theme = 'neon' | 'light' | 'dark';

export const THEMES: { id: Theme; label: string; emoji: string; hint: string }[] = [
  { id: 'neon', label: 'Неон', emoji: '🌌', hint: 'Как сейчас: фиолетовый неон' },
  { id: 'light', label: 'Светлая', emoji: '🌸', hint: 'Розовая, для яркого дня' },
  { id: 'dark', label: 'Тёмная', emoji: '🌚', hint: 'Спокойные серые тона' }
];

// Цвет адресной строки/статус-бара в мобильном браузере для каждой темы.
const THEME_COLORS: Record<Theme, string> = {
  neon: '#1f1147',
  light: '#f4f2f8',
  dark: '#1c1c20'
};

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'neon' ? stored : 'neon';
}

/** Ставит тему на <html> и запоминает выбор. Вызывается и при старте, и из настроек. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme]);
  localStorage.setItem(THEME_KEY, theme);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): UserDto | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserDto;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: UserDto): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveUser(user: UserDto): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}