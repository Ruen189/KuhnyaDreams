# Мобильная версия: от PWA к нативному приложению

## Что уже есть

Веб-клиент в `frontend` сразу сделан мобильным:

- вёрстка mobile-first: нижняя навигация `.tabbar`, карточка бинго на всю ширину, модалки-«шторки» (`Sheet`),
  учёт `env(safe-area-inset-bottom)` для iPhone с «челкой»;
- `public/manifest.webmanifest` + `public/icon.svg` — приложение ставится на домашний экран как PWA
  (`display: standalone`, портретная ориентация);
- токен хранится в `localStorage` (`bingo.token`), API-клиент `src/api.ts` работает с относительным `/api`,
  поэтому он же подходит для нативного клиента — достаточно подменить базовый адрес (`VITE_API_URL`).

Этого достаточно для личного использования: открыть сайт на телефоне → «Добавить на главный экран».

## Когда нужна нативная оболочка

Нативный клиент нужен, если хочется: push-уведомлений в системном трее, работы офлайн, виджета «карточка дня»
и доступа к календарю. Ниже — путь миграции без переписывания бэкенда.

## Шаг 1. React Native + Expo

1. `npx create-expo-app bingo-mobile --template blank-typescript`
2. Переиспользовать из веб-версии:
   - `src/types.ts` — DTO и перечисления (копируется как есть);
   - `src/api.ts` — тот же набор методов, только базовый адрес берётся из `expo-constants`
     (`extra.apiUrl`) вместо `import.meta.env`;
   - `src/session.ts` — заменить `localStorage` на `expo-secure-store` (`setItemAsync` / `getItemAsync`):
     JWT — чувствительные данные, в AsyncStorage его хранить не стоит.
3. Экраны: `Board`, `Tasks`, `Rewards`, `Stats`, `Settings` — структура совпадает с компонентами
   веб-клиента, поэтому логика переносится почти дословно, а разметка меняется на `View`/`Text`/`Pressable`.
4. Навигация — `expo-router` (файловая) или `@react-navigation/bottom-tabs` (5 вкладок, как в `.tabbar`).

## Шаг 2. Офлайн-режим

- Кэш списка задач и карточек кладём в `AsyncStorage` или `expo-sqlite`;
- очередь «отложенных» действий: отметка клетки, создание задачи. Формат записи:
  `{ id, method, path, body, createdAt }`;
- синхронизация при появлении сети; конфликты решает сервер, так как вся игровая логика
  (достижения, линии, прогресс) живёт на бэкенде и идемпотентна по своей сути —
  повторный `POST /api/boards/{id}/cells/{cellId}/toggle` просто вернёт актуальную карточку.

## Шаг 3. Push-уведомления (FCM)

1. На клиенте: `npx expo install expo-notifications`, получить токен устройства
   (`Notifications.getExpoPushTokenAsync()`).
2. На бэкенде: уведомления уже централизованы в `NotificationService.NotifyAsync` и фоновом
   `PeriodNotifier`. Достаточно добавить ещё одного получателя:
   - расширить `User` полем `PushToken` (`UserDto` + `UpdateUserRequest` + `PUT /api/users/me`);
   - в `NotificationService` после сохранения in-app уведомления вызывать новый
     `IPushSender` (`services.AddHttpClient<IPushSender, FcmPushSender>()`) по аналогии с
     существующим `ITelegramSender`;
   - ключ `Push:ServerKey` (или сервисный JSON Firebase) кладём в `appsettings` / переменные окружения,
     как это сделано для `Telegram:BotToken`.
3. Дедупликация уже решена: уведомления создаются с ключом (`achievement-{id}`, `board-start-{date}`),
   повторная отправка не дублируется.

## Шаг 4. Telegram (уже готово)

Бот работает прямо сейчас, без мобильного клиента:

1. Получите токен у @BotFather и задайте `Telegram__BotToken` (или `Telegram:BotToken` в `appsettings`).
2. Пользователь узнаёт свой chat id у @userinfobot и вводит его в «Настройки → Telegram chat id».
3. Кнопка «Проверить Telegram» вызывает `POST /api/notifications/telegram/test` и сразу отправляет
   тестовое сообщение. Дальше при включённом переключателе «Telegram» приходят напоминания
   о старте периода, прогрессе и бинго (тихие часы уважаются, кроме сообщения «Бинго!»).

## Чек-лист миграции

- [ ] API-адрес в одном месте (env/конфиг), без хардкода;
- [ ] JWT в `expo-secure-store`, авто-разлогин на 401 (в веб-клиенте это делает `request()` в `api.ts`);
- [ ] тёмная тема: цвета совпадают с токенами `src/styles.css`;
- [ ] вибрация при закрытии клетки (`expo-haptics`) — дешёвый и приятный аналог анимации;
- [ ] иконки/сплэш из `public/icon.svg`;
- [ ] push-токен сохраняется в профиле, уведомления доходят с ключом идемпотентности.