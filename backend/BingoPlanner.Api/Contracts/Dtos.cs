using BingoPlanner.Api.Domain;

namespace BingoPlanner.Api.Contracts;

// ---------- Auth ----------

public record RegisterRequest(string Email, string Password, string? DisplayName);
public record LoginRequest(string Email, string Password);

public record UserDto(
    Guid Id,
    string Email,
    string DisplayName,
    string? TelegramChatId,
    bool InAppEnabled,
    bool TelegramEnabled,
    bool NotifyOnPeriodStart,
    bool NotifyOnProgress,
    bool NotifyOnBingo,
    int QuietHoursStart,
    int QuietHoursEnd);

public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User);

public record UpdateUserRequest(
    string? DisplayName,
    string? TelegramChatId,
    bool? InAppEnabled,
    bool? TelegramEnabled,
    bool? NotifyOnPeriodStart,
    bool? NotifyOnProgress,
    bool? NotifyOnBingo,
    int? QuietHoursStart,
    int? QuietHoursEnd);

// ---------- Tasks ----------

public record TaskDto(
    Guid Id,
    string Title,
    string? Notes,
    string Category,
    TaskPriority Priority,
    TaskDifficulty Difficulty,
    int EstimatedMinutes,
    DateOnly? ScheduledDate,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    bool IsArchived,
    DateTime CreatedAt);

public record UpsertTaskRequest(
    string Title,
    string? Notes,
    string? Category,
    TaskPriority? Priority,
    TaskDifficulty? Difficulty,
    int? EstimatedMinutes,
    DateOnly? ScheduledDate,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    bool? IsArchived);

// ---------- Boards ----------

public record CreateBoardRequest(
    string? Title,
    BoardPeriod Period,
    DateOnly? StartDate,
    int? Size,
    List<Guid>? TaskIds,
    bool? Shuffle,
    bool? UseAllActiveTasks);

public record ReorderBoardRequest(List<Guid> CellIdsInOrder);
public record SwapCellsRequest(Guid CellId, Guid TargetCellId);

public record CellDto(
    Guid Id,
    int Position,
    Guid? TaskItemId,
    string Title,
    string? Category,
    TaskPriority Priority,
    bool IsFree,
    bool IsPlaceholder,
    DateTime? CompletedAt)
{
    public bool IsPlayable => !IsPlaceholder;
    public bool IsCompleted => IsFree || CompletedAt is not null;
}

public record LineDto(int Index, string Kind, bool IsActive, bool IsComplete, int Missing);

public record ProgressDto(
    int Size,
    int PlayableCells,
    int CompletedCells,
    int Percent,
    int CompletedLines,
    int ActiveLines,
    int CellsToNextLine,
    bool HasBingo,
    bool IsFullCard);

public record AchievementDto(
    Guid Id,
    Guid BoardId,
    string BoardTitle,
    AchievementKind Kind,
    int Metric,
    string Title,
    string Description,
    DateTime UnlockedAt,
    AchievementStatus Status,
    Guid? RewardId,
    string? RewardTitle,
    string? RewardEmoji,
    DateTime? ResolvedAt);

public record BoardDto(
    Guid Id,
    string Title,
    BoardPeriod Period,
    BoardStatus Status,
    int Size,
    DateOnly StartDate,
    DateOnly EndDate,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    ProgressDto Progress,
    List<CellDto> Cells,
    List<LineDto> Lines,
    List<AchievementDto> Achievements);

public record BoardSummaryDto(
    Guid Id,
    string Title,
    BoardPeriod Period,
    BoardStatus Status,
    int Size,
    DateOnly StartDate,
    DateOnly EndDate,
    int CompletedCells,
    int PlayableCells,
    int Percent,
    int CompletedLines,
    bool HasBingo,
    DateTime? CompletedAt);

/// <summary>Результат отметки ячейки: обновлённая карточка + то, что только что открылось.</summary>
public record ToggleCellResponse(
    BoardDto Board,
    List<AchievementDto> NewAchievements,
    List<RewardDto> SuggestedRewards,
    ProgressDto PreviousProgress);

// ---------- Rewards ----------

public record RewardDto(Guid Id, string Title, string? Description, string Emoji, bool IsArchived, DateTime CreatedAt);
public record UpsertRewardRequest(string Title, string? Description, string? Emoji, bool? IsArchived);

public record ResolveAchievementRequest(Guid? RewardId, bool Skip, string? Note);

// ---------- Notifications ----------

public record NotificationDto(
    Guid Id,
    Guid? BoardId,
    NotificationType Type,
    string Title,
    string Body,
    bool SentToTelegram,
    DateTime CreatedAt,
    DateTime? ReadAt);

public record NotificationFeedDto(int UnreadCount, List<NotificationDto> Items);

public record TelegramTestRequest(string ChatId);
public record TelegramTestResult(bool Sent, string Message);

// ---------- Stats ----------

public record CategoryStatDto(string Category, int Completed, int Total);

public record StatsSummaryDto(
    int TotalTasks,
    int CompletedCells,
    int ActiveBoards,
    int CompletedBoards,
    int LinesCollected,
    int BingosCollected,
    int RewardsRedeemed,
    int CurrentStreakDays,
    int LongestStreakDays);

public record DailyStatDto(DateOnly Date, int Completed);

public record StatsResponse(
    StatsSummaryDto Summary,
    List<DailyStatDto> Daily,
    List<CategoryStatDto> Categories,
    List<BoardSummaryDto> History);