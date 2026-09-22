using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Domain;

namespace BingoPlanner.Api.Services;

public static class Mappers
{
    public static UserDto ToDto(this User u) => new(
        u.Id, u.Email, u.DisplayName, u.TelegramChatId,
        u.InAppEnabled, u.TelegramEnabled, u.NotifyOnPeriodStart, u.NotifyOnProgress, u.NotifyOnBingo,
        u.QuietHoursStart, u.QuietHoursEnd);

    public static TaskDto ToDto(this TaskItem t) => new(
        t.Id, t.Title, t.Notes, t.Category, t.Priority, t.Difficulty, t.EstimatedMinutes,
        t.ScheduledDate, t.StartTime, t.EndTime, t.IsArchived, t.CreatedAt);

    public static RewardDto ToDto(this Reward r) => new(r.Id, r.Title, r.Description, r.Emoji, r.IsArchived, r.CreatedAt);

    public static NotificationDto ToDto(this Notification n) => new(
        n.Id, n.BoardId, n.Type, n.Title, n.Body, n.SentToTelegram, n.CreatedAt, n.ReadAt);

    public static CellDto ToDto(this BoardCell c) => new(
        c.Id, c.Position, c.TaskItemId, c.Title, c.Category, c.Priority,
        c.IsFree, c.IsPlaceholder, c.CompletedAt);

    public static LineDto ToDto(this LineInfo l) => new(l.Index, l.Kind, l.IsActive, l.IsComplete, l.Missing);

    public static ProgressDto ToDto(this ProgressResult p) => new(
        p.Size, p.PlayableCells, p.CompletedCells, p.Percent, p.CompletedLines, p.ActiveLines,
        p.CellsToNextLine, p.HasBingo, p.IsFullCard);

    public static AchievementDto ToDto(this Achievement a, string boardTitle, Reward? reward) => new(
        a.Id, a.BoardId, boardTitle, a.Kind, a.Metric, a.Title, a.Description, a.UnlockedAt,
        a.Status, a.RewardId, reward?.Title, reward?.Emoji, a.ResolvedAt);

    public static BoardDto ToDto(this Board board, ProgressResult progress, IEnumerable<Achievement> achievements, IReadOnlyDictionary<Guid, Reward> rewards) => new(
        board.Id,
        board.Title,
        board.Period,
        board.Status,
        board.Size,
        board.StartDate,
        board.EndDate,
        board.CreatedAt,
        board.CompletedAt,
        progress.ToDto(),
        board.Cells.OrderBy(c => c.Position).Select(c => c.ToDto()).ToList(),
        progress.Lines.Select(l => l.ToDto()).ToList(),
        achievements
            .OrderBy(a => a.UnlockedAt)
            .Select(a => a.ToDto(board.Title, a.RewardId is Guid rid && rewards.TryGetValue(rid, out var r) ? r : null))
            .ToList());

    public static BoardSummaryDto ToSummary(this Board board, ProgressResult progress) => new(
        board.Id, board.Title, board.Period, board.Status, board.Size, board.StartDate, board.EndDate,
        progress.CompletedCells, progress.PlayableCells, progress.Percent, progress.CompletedLines,
        progress.HasBingo, board.CompletedAt);
}