# Бинго-планировщик 🎲

Планировщик задач, который работает как бинго: обычный список дел превращается в карточку 3×3, 4×4 или 5×5,
закрытые клетки собираются в линии, за линии и полные карточки выдаются **достижения**, а к достижениям
привязываются **награды**. Всё это с прогрессом, сериями дней, лентой уведомлений и Telegram-ботом.

Проект состоит из двух частей:

| Часть | Технологии | Каталог |
| --- | --- | --- |
| API + игровая логика | ASP.NET Core 9 (Minimal API), EF Core 9, SQLite / PostgreSQL, JWT | `backend/BingoPlanner.Api` |
| Тесты игровой логики | xUnit | `backend/BingoPlanner.Tests` |
| Мобильный веб-клиент (PWA) | React 19 + TypeScript + Vite | `frontend` |

---

## Быстрый старт (разработка)

Нужны .NET SDK 9 и Node.js 20+.

```powershell
# 1. API на http://localhost:5207 (Development-профиль включает демо-данные)
cd backend\BingoPlanner.Api
dotnet run

# 2. Фронтенд на http://localhost:5173 (запросы /api проксируются на 5207)
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173 и войдите демо-доступом:

```
demo@bingo.local / demo1234
```

Демо-пользователь (`Seed:DemoData = true`) создаётся только для пустой базы и уже содержит 10 задач
по категориям и 5 наград.

## Сборка единого артефакта (API отдаёт SPA)

```powershell
cd frontend
npm run build:api   # tsc + vite build + копирование dist в backend\BingoPlanner.Api\wwwroot
cd ..\backend\BingoPlanner.Api
dotnet run          # http://localhost:5207 — и интерфейс, и API на одном порту
```

`Program.cs` поднимает статику и SPA-fallback (`MapFallbackToFile("index.html")`) только если `wwwroot/index.html`
существует, поэтому обычная разработка через Vite от этого не страдает.

## GitHub Pages (демо интерфейса)

Репозиторий: `https://github.com/Ruen189/KuhnyaDreams` → адрес Pages: **https://ruen189.github.io/KuhnyaDreams/**.
Workflow `.github/workflows/deploy-pages.yml` собирает `frontend` и публикует папку `dist` при каждом пуше в `main`.

**Что нужно сделать один раз на GitHub:**

1. **Settings → Pages → Build and deployment → Source: `GitHub Actions`** (не «Deploy from a branch»).
2. **Settings → Secrets and variables → Actions → вкладка Variables → New repository variable**:
   - имя `API_URL`, значение — адрес вашего бэкенда по HTTPS, без слэша на конце
     (например `https://bingo-api.onrender.com`).
   - без этой переменной Pages отдаст интерфейс, но вход не сработает: страница сама покажет подсказку.
3. **Разрешить CORS на бэкенде**: в `appsettings.json` в `Cors:Origins` добавить `https://ruen189.github.io`
   (или переменной окружения `Cors__Origins__0=https://ruen189.github.io`), иначе браузер отрежет запросы к API.
4. Запустить сборку: `Actions → Deploy frontend to GitHub Pages → Run workflow`
   (или просто запушить изменение в `frontend/`). Через ~1 минуту сайт будет доступен по адресу выше.

**Куда деплоить API.** Pages — это только статика, данные лежат на сервере. Варианты для бэкенда:
`docker compose up -d --build` на VPS, Render/Railway/Fly.io (в репозитории уже есть готовый `Dockerfile`),
либо собственный сервер с HTTPS. Важно: Pages работает по HTTPS, поэтому API тоже должен быть по HTTPS —
иначе браузер заблокирует запросы как mixed content.

**Локальная проверка Pages-сборки:**

```powershell
cd frontend
$env:VITE_BASE = '/KuhnyaDreams/'
$env:VITE_API_URL = 'http://localhost:8080'
npm run build
npx vite preview --base=/KuhnyaDreams/    # http://localhost:4173/KuhnyaDreams/
```

## Docker (PostgreSQL + собранная SPA)

```bash
docker compose up --build
# http://localhost:8080
```

Имя compose-проекта зафиксировано в `docker-compose.yml` полем `name: bingo`. Это обязательно:
папка проекта называется «Бинго», а compose строит имя проекта из имени каталога и выбрасывает
не-ASCII символы — без поля `name` остаётся пустая строка и любая команда падает с ошибкой
`project name must not be empty`. Если версия compose не поддерживает `name:` (< 2.3.3),
задайте имя снаружи: `docker compose -p bingo up --build` или `$env:COMPOSE_PROJECT_NAME = 'bingo'`.

Итоговые имена ресурсов: контейнеры/образы `bingo-db` и `bingo-api`, том `bingo_bingo-pgdata`
(`docker compose down -v` удаляет данные PostgreSQL).

Контейнер API собирает фронтенд внутри себя (multi-stage `backend/BingoPlanner.Api/Dockerfile`).
По умолчанию приложение работает на SQLite (`bingo.db` рядом с бинарником); PostgreSQL включается
ключом `Database:Provider = "Postgres"`.

---

## Как играть

1. **Задачи** — добавьте 8–12 дел с категорией, приоритетом и оценкой времени. Есть быстрое добавление
   списком (каждая строка — задача).
2. **Карточка** — нажмите «Новая карточка», выберите период (день/неделя/месяц) и поле 3×3…5×5.
   Размер можно оставить автоматическим: `BoardFactory.AutoSize` подберёт минимальный квадрат,
   в который задачи помещаются с 0–2 «пустыми» слотами.
3. **Игра** — тапайте клетки, чтобы закрыть задачу. В карточке всегда есть одна «свободная клетка» —
   бесплатный бонус, как в настоящем бинго.
4. **Достижения** — при закрытии первой клетки, линии, двух линий, половины карточки, «почти всё»
   и полной карточки появляется праздничное окно с предложением выбрать награду (или пропустить).
5. **Награды** — каталог личных наград с эмодзи; их можно архивировать и удалять.
6. **Статистика** — закрытые клетки, линии, бинго, серии дней подряд, активность по дням и разбивка по категориям.
7. **Настройки** — имя, Telegram chat id, переключатели уведомлений, тихие часы, ручной запуск фоновых проверок.

Перестановка клеток: кнопка «🔄 Поменять клетки» → тап по первой → тап по второй.
Кнопка «🎲 Перемешать» случайно тасует всё поле.

## Адаптивность интерфейса

Вёрстка не «мобильная с фиксированной шириной», а плавная: базовые размеры заданы
`clamp()`-токенами в `:root` (`--font-ui`, `--gap`, `--pad-card`, `--control-h`, `--shell-max`),
поэтому текст, отступы, поля ввода и кнопки растут вместе с окном, но ограничены сверху,
чтобы на 27-дюймовом мониторе ничего не выглядело гигантским.

| Ширина окна | Что происходит |
| --- | --- |
| ≤ 819px | Одна колонка, ширина до 560px, как в мобильном макете |
| ≥ 820px | Экран входа/регистрации — две колонки (слева рассказ о приложении, справа форма), суммарно до 1080px |
| ≥ 900px | Приложение — сетка из двух колонок (карточка слева, остальное справа), нижняя навигация превращается в плавающий док |
| ≤ 819px и высота ≤ 560px | «Телефон в ландшафте»: вводный блок скрыт, форма входа прижата к верху — вход всегда доступен без прокрутки |
| ≥ 820px и высота ≤ 720px | Невысокие окна ноутбуков: вход центрируется по горизонтали, но начинается от верха |

## API (кратко)

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | регистрация и вход, возвращают JWT |
| GET/PUT | `/api/users/me` | профиль и настройки уведомлений |
| GET/POST | `/api/tasks`, `/api/tasks/bulk` | список и создание задач |
| PUT/PATCH/DELETE | `/api/tasks/{id}`, `/api/tasks/{id}/archive` | правка, архив, удаление |
| GET | `/api/tasks/categories` | используемые категории |
| GET | `/api/boards`, `/api/boards/current`, `/api/boards/{id}` | история, активные сейчас, карточка целиком |
| POST | `/api/boards` | сформировать карточку из задач |
| POST | `/api/boards/{id}/cells/{cellId}/toggle` | отметка клетки + новые достижения и награды |
| PUT/POST | `/api/boards/{id}/layout`, `/api/boards/{id}/cells/swap`, `/api/boards/{id}/shuffle` | раскладка поля |
| PATCH/DELETE | `/api/boards/{id}/status`, `/api/boards/{id}` | статус и удаление карточки |
| GET | `/api/achievements`, POST `/api/achievements/{id}/resolve` | достижения и выбор награды |
| GET/POST/PUT/DELETE | `/api/rewards` | каталог наград |
| GET/POST/DELETE | `/api/notifications`, `/read-all`, `/telegram/test`, `/run-checks` | лента и уведомления |
| GET | `/api/stats?days=30` | сводка, активность по дням, категории, история |
| GET | `/api/health` | статус, провайдер БД, настроен ли бот |

Подробные схемы — в `backend/BingoPlanner.Api/BingoPlanner.Api.http` и через OpenAPI
(`/openapi/v1.json` в Development).

## Тесты

```powershell
# Юнит- и сквозные тесты игровой логики (xUnit)
dotnet test backend\BingoPlanner.Tests\BingoPlanner.Tests.csproj

# Дымовой тест API: поднимает приложение и проходит путь пользователя
powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1
```

`scripts/smoke.ps1` регистрирует пользователя, создаёт 9 задач, собирает карточку 3×3, закрывает все клетки,
проверяет выдачу достижений, закрепление награды, ленту уведомлений, статистику и отдачу SPA.

Покрыты чистая игровая логика (`ProgressCalculator`, `BoardFactory`) и сквозной сценарий
создания карточки → отметки клеток → достижения/награды → статистика.

## Структура

```
backend/BingoPlanner.Api
  Contracts/     DTO запросов и ответов
  Domain/        сущности EF Core
  Data/          AppDbContext, демо-данные
  Endpoints/     Minimal API по группам (auth, tasks, boards, rewards, notifications, stats)
  Services/      AuthService, BoardFactory, GameService, ProgressCalculator, TelegramSender, PeriodNotifier
frontend
  src/api.ts     типизированный клиент API
  src/App.tsx    оболочка: сессия, вкладки, уведомления
  src/components экраны: карточка, задачи, награды, статистика, настройки, вход
  src/styles.css тёмная тема, мобильная вёрстка
docs/MOBILE.md   как превратить клиент в нативное приложение (Expo/React Native + FCM + Telegram)
```