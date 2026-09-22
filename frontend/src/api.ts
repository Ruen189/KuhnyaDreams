import type {
  AchievementDto,
  AchievementStatus,
  AuthResponse,
  BoardDto,
  BoardSummaryDto,
  BoardStatus,
  NotificationDto,
  NotificationFeedDto,
  RewardDto,
  StatsResponse,
  TaskDifficulty,
  TaskDto,
  TaskPriority,
  TelegramTestResult,
  ToggleCellResponse,
  UserDto
} from './types';
import type { BoardPeriod } from './types';
import { clearSession, getToken, saveSession } from './session';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = response.status === 204 ? '' : await response.text();

  if (!response.ok) {
    if (response.status === 401) clearSession();
    let message = `Ошибка ${response.status}`;
    if (text) {
      try {
        const data = JSON.parse(text) as { error?: string; title?: string; detail?: string };
        message = data.error ?? data.detail ?? data.title ?? message;
      } catch {
        message = text;
      }
    }
    throw new ApiError(response.status, message);
  }

  return (text ? JSON.parse(text) : undefined) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export interface TaskInput {
  title: string;
  notes?: string | null;
  category?: string | null;
  priority?: TaskPriority;
  difficulty?: TaskDifficulty;
  estimatedMinutes?: number;
  scheduledDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isArchived?: boolean;
}

export interface UpdateUserInput {
  displayName?: string | null;
  telegramChatId?: string | null;
  inAppEnabled?: boolean;
  telegramEnabled?: boolean;
  notifyOnPeriodStart?: boolean;
  notifyOnProgress?: boolean;
  notifyOnBingo?: boolean;
  quietHoursStart?: number;
  quietHoursEnd?: number;
}

export interface BoardInput {
  title?: string | null;
  period: BoardPeriod;
  startDate?: string | null;
  size?: number | null;
  taskIds?: string[] | null;
  shuffle?: boolean;
  useAllActiveTasks?: boolean;
}

export interface RewardInput {
  title: string;
  description?: string | null;
  emoji?: string | null;
  isArchived?: boolean;
}

export const api = {
  async register(email: string, password: string, displayName?: string): Promise<UserDto> {
    const result = await post<AuthResponse>('/api/auth/register', {
      email,
      password,
      displayName: displayName ?? null
    });
    saveSession(result.token, result.user);
    return result.user;
  },

  async login(email: string, password: string): Promise<UserDto> {
    const result = await post<AuthResponse>('/api/auth/login', { email, password });
    saveSession(result.token, result.user);
    return result.user;
  },

  me: () => request<UserDto>('/api/users/me'),

  updateMe: (patch: UpdateUserInput) =>
    request<UserDto>('/api/users/me', { method: 'PUT', body: JSON.stringify(patch) }),

  tasks: (includeArchived = false) => request<TaskDto[]>(`/api/tasks/?includeArchived=${includeArchived}`),
  taskCategories: () => request<string[]>('/api/tasks/categories'),
  createTask: (input: TaskInput) => post<TaskDto>('/api/tasks/', input),
  updateTask: (id: string, input: TaskInput) =>
    request<TaskDto>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  archiveTask: (id: string, archived: boolean) =>
    request<TaskDto>(`/api/tasks/${id}/archive?archived=${archived}`, { method: 'PATCH' }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  createTasksBulk: (inputs: TaskInput[]) => post<TaskDto[]>('/api/tasks/bulk', inputs),

  boards: (status?: BoardStatus, take = 50) =>
    request<BoardSummaryDto[]>(
      `/api/boards/?take=${take}${status === undefined ? '' : `&status=${status}`}`
    ),
  currentBoards: (period?: BoardPeriod) =>
    request<BoardDto[]>(`/api/boards/current${period === undefined ? '' : `?period=${period}`}`),
  board: (id: string) => request<BoardDto>(`/api/boards/${id}`),
  createBoard: (input: BoardInput) => post<BoardDto>('/api/boards/', input),
  toggleCell: (boardId: string, cellId: string) =>
    post<ToggleCellResponse>(`/api/boards/${boardId}/cells/${cellId}/toggle`),
  shuffleBoard: (boardId: string) => post<BoardDto>(`/api/boards/${boardId}/shuffle`),
  reorderBoard: (boardId: string, cellIdsInOrder: string[]) =>
    request<BoardDto>(`/api/boards/${boardId}/layout`, {
      method: 'PUT',
      body: JSON.stringify({ cellIdsInOrder })
    }),
  swapCells: (boardId: string, cellId: string, targetCellId: string) =>
    post<BoardDto>(`/api/boards/${boardId}/cells/swap`, { cellId, targetCellId }),
  boardStatus: (boardId: string, status: BoardStatus) =>
    request<BoardDto>(`/api/boards/${boardId}/status?status=${status}`, { method: 'PATCH' }),
  deleteBoard: (boardId: string) => request<void>(`/api/boards/${boardId}`, { method: 'DELETE' }),

  achievements: (status?: AchievementStatus, boardId?: string) =>
    request<AchievementDto[]>(
      `/api/achievements/?${status === undefined ? '' : `status=${status}&`}${boardId ? `boardId=${boardId}` : ''}`
    ),
  resolveAchievement: (id: string, rewardId: string | null, skip: boolean, note?: string | null) =>
    post<AchievementDto>(`/api/achievements/${id}/resolve`, { rewardId, skip, note: note ?? null }),

  rewards: (includeArchived = false) => request<RewardDto[]>(`/api/rewards/?includeArchived=${includeArchived}`),
  createReward: (input: RewardInput) => post<RewardDto>('/api/rewards/', input),
  updateReward: (id: string, input: RewardInput) =>
    request<RewardDto>(`/api/rewards/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteReward: (id: string) => request<void>(`/api/rewards/${id}`, { method: 'DELETE' }),

  notifications: (take = 50, unreadOnly = false) =>
    request<NotificationFeedDto>(`/api/notifications/?take=${take}&unreadOnly=${unreadOnly}`),
  readNotification: (id: string) => post<NotificationDto>(`/api/notifications/${id}/read`),
  readAllNotifications: () => post<{ read: number }>('/api/notifications/read-all'),
  clearNotifications: () => request<void>('/api/notifications/', { method: 'DELETE' }),
  testTelegram: (chatId: string) =>
    post<TelegramTestResult>('/api/notifications/telegram/test', { chatId }),
  runChecks: () => post<{ created: number }>('/api/notifications/run-checks'),

  stats: (days = 30) => request<StatsResponse>(`/api/stats/?days=${days}`)
};