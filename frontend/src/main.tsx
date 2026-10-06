import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, getTheme } from './session';
import './styles.css';

// Тему ставим до первого рендера, чтобы не мигало «неоновым» на светлой и тёмной.
// Первое применение — без анимации: пользователь ещё ничего не переключал.
applyTheme(getTheme(), false);

const container = document.getElementById('root');
if (!container) throw new Error('Не найден корневой элемент #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);