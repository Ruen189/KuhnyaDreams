namespace BingoPlanner.Api.Domain;

public enum TaskPriority { Low = 0, Normal = 1, High = 2 }

public enum TaskDifficulty { Easy = 1, Medium = 2, Hard = 3 }

public enum BoardPeriod { Day = 0, Week = 1, Month = 2 }

public enum BoardStatus { Active = 0, Completed = 1, Archived = 2 }

/// <summary>Вид игрового достижения на карточке.</summary>
public enum AchievementKind
{
    FirstCell = 0,   // первая закрытая ячейка
    Line = 1,        // закрытая линия (номер линии в Metric)
    TwoLines = 2,    // две и более линий
    HalfCard = 3,    // 50% карточки
    AlmostFull = 4,  // 75% карточки
    FullCard = 5     // вся карточка
}

public enum AchievementStatus { Suggested = 0, Rewarded = 1, Skipped = 2 }

public enum NotificationType { PeriodStart = 0, Progress = 1, NearBingo = 2, Bingo = 3, Reminder = 4, Reward = 5, System = 6 }

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string PasswordSalt { get; set; } = string.Empty;
    public string? TelegramChatId { get; set; }
    public string TimeZone { get; set; } = "Europe/Moscow";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Настройки уведомлений (плоско, чтобы не усложнять прототип owned-типами)
    public bool InAppEnabled { get; set; } = true;
    public bool TelegramEnabled { get; set; } = false;
    public bool NotifyOnPeriodStart { get; set; } = true;
    public bool NotifyOnProgress { get; set; } = true;
    public bool NotifyOnBingo { get; set; } = true;
    public int QuietHoursStart { get; set; } = 22; // час, с которого уведомления не отправляются
    public int QuietHoursEnd { get; set; } = 8;    // час, с которого уведомления снова можно отправлять

    public List<TaskItem> Tasks { get; set; } = [];
    public List<Board> Boards { get; set; } = [];
    public List<Reward> Rewards { get; set; } = [];
}

public class TaskItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string Category { get; set; } = "Общее";
    public TaskPriority Priority { get; set; } = TaskPriority.Normal;
    public TaskDifficulty Difficulty { get; set; } = TaskDifficulty.Medium;
    public int EstimatedMinutes { get; set; } = 30;

    public DateOnly? ScheduledDate { get; set; }
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }

    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Board
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Title { get; set; } = string.Empty;
    public BoardPeriod Period { get; set; } = BoardPeriod.Day;
    public BoardStatus Status { get; set; } = BoardStatus.Active;
    public int Size { get; set; } = 3;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public List<BoardCell> Cells { get; set; } = [];
}

public class BoardCell
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BoardId { get; set; }
    public Board? Board { get; set; }

    /// <summary>Позиция в сетке, 0..(Size*Size-1), слева-вправо сверху-вниз.</summary>
    public int Position { get; set; }

    public Guid? TaskItemId { get; set; }
    public TaskItem? TaskItem { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Category { get; set; }
    public TaskPriority Priority { get; set; } = TaskPriority.Normal;

    /// <summary>Бонусная "свободная" ячейка (классический free space) — считается выполненной сразу.</summary>
    public bool IsFree { get; set; }

    /// <summary>Пустая ячейка-заполнитель: не играет роли в прогрессе и не разрывает линии.</summary>
    public bool IsPlaceholder { get; set; }

    public DateTime? CompletedAt { get; set; }
}

public class Reward
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Emoji { get; set; } = "🎁";
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Achievement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid BoardId { get; set; }
    public Board? Board { get; set; }

    public AchievementKind Kind { get; set; }
    public int Metric { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime UnlockedAt { get; set; } = DateTime.UtcNow;

    public AchievementStatus Status { get; set; } = AchievementStatus.Suggested;
    public Guid? RewardId { get; set; }
    public Reward? Reward { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? BoardId { get; set; }

    public NotificationType Type { get; set; } = NotificationType.System;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string DedupeKey { get; set; } = string.Empty;
    public bool SentToTelegram { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}