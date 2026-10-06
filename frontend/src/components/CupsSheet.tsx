import type { AchievementDto } from '../types';
import { formatDateTime } from '../utils/board';
import { Sheet } from './ui';

/**
 * Пояснение к кубкам: за какие достижения они начислены.
 * Открывается тапом по алерту (только что полученные кубки) и из шапки (вся история).
 */
export default function CupsSheet({
  achievements,
  available,
  spent,
  onClose
}: {
  achievements: AchievementDto[];
  available: number;
  spent: number;
  onClose: () => void;
}) {
  return (
    <Sheet title="Кубки" onClose={onClose}>
      <div className="stack">
        <div className="row row--wrap">
          <span className="cup-balance">🏆 {available} свободно</span>
          <span className="tiny muted">1 кубок за каждое достижение · потрачено: {spent}</span>
        </div>

        {achievements.length === 0 ? (
          <p className="card__hint">Пока ни одного достижения — закройте первую клетку, и кубок ваш.</p>
        ) : (
          <div className="list">
            {achievements.map((item) => (
              <div key={item.id} className="list__item">
                <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                  🏆
                </span>
                <span className="list__item-main">
                  <span className="list__item-title">{item.title}</span>
                  <span className="list__item-meta">{item.description}</span>
                  <span className="list__item-meta">
                    {item.boardTitle} · {formatDateTime(item.unlockedAt)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="tiny muted">Обменять кубок можно на вкладке «Награды»: один кубок — одна награда.</p>
      </div>
    </Sheet>
  );
}