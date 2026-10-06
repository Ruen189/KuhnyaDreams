import { plural } from '../utils/board';

/**
 * Кликабельный алерт над карточкой: сколько кубков только что получено.
 * Подписи «нажми» нет специально — плашка сама выглядит нажимаемой, подробности открываются тапом.
 */
export default function CupsAlert({ count, onClick }: { count: number; onClick: () => void }) {
  const headline =
    count === 1 ? 'Получен кубок!' : `Получено ${count} ${plural(count, 'кубок', 'кубка', 'кубков')}!`;

  return (
    <button
      type="button"
      className="cup-alert span-full"
      onClick={onClick}
      aria-label={`${headline} Нажмите, чтобы узнать, за что начислены кубки.`}
    >
      <span className="cup-alert__cup" aria-hidden="true">
        🏆
      </span>
      <span className="cup-alert__text">{headline}</span>
      <span className="cup-alert__chevron" aria-hidden="true">
        ›
      </span>
    </button>
  );
}