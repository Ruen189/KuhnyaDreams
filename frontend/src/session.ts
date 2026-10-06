import type { UserDto } from './types';

const TOKEN_KEY = 'bingo.token';
const USER_KEY = 'bingo.user';
const THEME_KEY = 'bingo.theme';

export type Theme = 'neon' | 'light' | 'dark';

export const THEMES: { id: Theme; label: string; emoji: string; hint: string }[] = [
  { id: 'neon', label: 'Неон', emoji: '🌌', hint: 'Фиолетовый фон, яркие неоновые акценты' },
  { id: 'light', label: 'Светлая', emoji: '🌸', hint: 'Тёплый бежевый фон, приглушённая яркость' },
  { id: 'dark', label: 'Тёмная', emoji: '🌚', hint: 'Спокойные серые тона' }
];

// Цвет адресной строки/статус-бара в мобильном браузере для каждой темы.
const THEME_COLORS: Record<Theme, string> = {
  neon: '#1f1147',
  light: '#f2e9dc',
  dark: '#1c1c20'
};

/** Сколько держать переходной класс, если браузер не умеет View Transitions. */
const THEME_TRANSITION_MS = 420;

let themeTransitionTimer: number | undefined;

/** Браузеры без View Transitions плавно меняют цвета через короткий класс на <html>. */
function flashThemeTransition(root: HTMLElement): void {
  root.classList.add('theme-switching');
  window.clearTimeout(themeTransitionTimer);
  themeTransitionTimer = window.setTimeout(() => root.classList.remove('theme-switching'), THEME_TRANSITION_MS);
}

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'neon' ? stored : 'neon';
}

/**
 * Ставит тему на <html> и запоминает выбор. Вызывается и при старте, и из настроек.
 * Смена темы анимируется: в современных браузерах — кроссфейд через View Transitions
 * (он плавно перекрашивает и градиенты), иначе — короткий переход по цветам.
 * При первом применении (старт приложения) анимация не нужна — `animate: false`.
 */
export function applyTheme(theme: Theme, animate = true): void {
  const root = document.documentElement;
  const commit = () => {
    root.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[theme]);
    localStorage.setItem(THEME_KEY, theme);
  };

  if (!animate) {
    root.classList.remove('theme-switching');
    commit();
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startViewTransition = (
    document as Document & { startViewTransition?: (callback: () => void) => unknown }
  ).startViewTransition;

  if (!reduceMotion && typeof startViewTransition === 'function') {
    startViewTransition.call(document, commit);
    return;
  }

  if (!reduceMotion) flashThemeTransition(root);
  commit();
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