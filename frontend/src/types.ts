// Типы повторяют DTO бэкенда (BingoPlanner.Api/Contracts/Dtos.cs).
// Перечисления приходят числами — System.Text.Json по умолчанию так их и сериализует.

export enum TaskPriority {
  Low = 0,
  Normal = 1,
  High = 2
}

export enum TaskDifficulty {
  Easy = 1,
  Medium = 2,
  Hard = 3
}

export enum BoardPeriod {
  Day = 0,
  Week = 1,
  Month = 2
}

export enum BoardStatus {
  Active = 0,
  Completed = 1,
  Archived = 2
}

export enum AchievementKind {
  FirstCell = 0,
  Line = 1,
  TwoLines = 2,
  HalfCard = 3,
  AlmostFull = 4,
  FullCard = 5
}

export enum AchievementStatus {
  Suggested = 0,
  Rewarded = 1,
  Skipped = 2
}

export enum NotificationType {
  PeriodStart = 0,
  Progress = 1,
  NearBingo = 2,
  Bingo = 3,
  Reminder = 4,
  Reward = 5,
  System = 6
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  telegramChatId: string | null;
  inAppEnabled: boolean;
  telegramEnabled: boolean;
  notifyOnPeriodStart: boolean;
  notifyOnProgress: boolean;
  notifyOnBingo: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface TaskDto {
  id: string;
  title: string;
  notes: string | null;
  category: string;
  priority: TaskPriority;
  difficulty: TaskDifficulty;
  estimatedMinutes: number;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface CellDto {
  id: string;
  position: number;
  taskItemId: string | null;
  title: string;
  category: string | null;
  priority: TaskPriority;
  isFree: boolean;
  isPlaceholder: boolean;
  completedAt: string | null;
  isPlayable: boolean;
  isCompleted: boolean;
}

export interface LineDto {
  index: number;
  kind: string;
  isActive: boolean;
  isComplete: boolean;
  missing: number;
}

export interface ProgressDto {
  size: number;
  playableCells: number;
  completedCells: number;
  percent: number;
  completedLines: number;
  activeLines: number;
  cellsToNextLine: number;
  hasBingo: boolean;
  isFullCard: boolean;
}

export interface AchievementDto {
  id: string;
  boardId: string;
  boardTitle: string;
  kind: AchievementKind;
  metric: number;
  title: string;
  description: string;
  unlockedAt: string;
  status: AchievementStatus;
  rewardId: string | null;
  rewardTitle: string | null;
  rewardEmoji: string | null;
  resolvedAt: string | null;
}

export interface BoardDto {
  id: string;
  title: string;
  period: BoardPeriod;
  status: BoardStatus;
  size: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  completedAt: string | null;
  progress: ProgressDto;
  cells: CellDto[];
  lines: LineDto[];
  achievements: AchievementDto[];
}

export interface BoardSummaryDto {
  id: string;
  title: string;
  period: BoardPeriod;
  status: BoardStatus;
  size: number;
  startDate: string;
  endDate: string;
  completedCells: number;
  playableCells: number;
  percent: number;
  completedLines: number;
  hasBingo: boolean;
  completedAt: string | null;
}

export interface ToggleCellResponse {
  board: BoardDto;
  newAchievements: AchievementDto[];
  suggestedRewards: RewardDto[];
  previousProgress: ProgressDto;
}

export interface RewardDto {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  isArchived: boolean;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  boardId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  sentToTelegram: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationFeedDto {
  unreadCount: number;
  items: NotificationDto[];
}

export interface StatsSummaryDto {
  totalTasks: number;
  completedCells: number;
  activeBoards: number;
  completedBoards: number;
  linesCollected: number;
  bingosCollected: number;
  rewardsRedeemed: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export interface DailyStatDto {
  date: string;
  completed: number;
}

export interface CategoryStatDto {
  category: string;
  completed: number;
  total: number;
}

export interface StatsResponse {
  summary: StatsSummaryDto;
  daily: DailyStatDto[];
  categories: CategoryStatDto[];
  history: BoardSummaryDto[];
}

export interface TelegramTestResult {
  sent: boolean;
  message: string;
}

export const PERIOD_LABELS: Record<BoardPeriod, string> = {
  [BoardPeriod.Day]: 'День',
  [BoardPeriod.Week]: 'Неделя',
  [BoardPeriod.Month]: 'Месяц'
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.Low]: 'Низкий',
  [TaskPriority.Normal]: 'Обычный',
  [TaskPriority.High]: 'Важный'
};

export const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]: 'Легко',
  [TaskDifficulty.Medium]: 'Средне',
  [TaskDifficulty.Hard]: 'Сложно'
};

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  [NotificationType.PeriodStart]: '🚀',
  [NotificationType.Progress]: '🎯',
  [NotificationType.NearBingo]: '🔥',
  [NotificationType.Bingo]: '🎉',
  [NotificationType.Reminder]: '⏰',
  [NotificationType.Reward]: '🎁',
  [NotificationType.System]: 'ℹ️'
};

export const BOARD_STATUS_LABELS: Record<BoardStatus, string> = {
  [BoardStatus.Active]: 'Активная',
  [BoardStatus.Completed]: 'Закрыта',
  [BoardStatus.Archived]: 'В архиве'
};