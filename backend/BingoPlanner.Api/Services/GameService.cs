using System.Globalization;
using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Services;

/// <summary>
/// Игровая логика: формирование карточки, отметка ячеек, достижения и предложение награды.
/// </summary>
public class GameService(AppDbContext db, NotificationService notifications, ILogger<GameService> logger)
{
    public const int SuggestedRewardCount = 3;

    public static ProgressResult Progress(Board board) => ProgressCalculator.Compute(
        board.Size,
        board.Cells
            .OrderBy(c => c.Position)
            .Select(c => new CellState(IsPlayable: !c.IsPlaceholder, IsCompleted: c.IsFree || c.CompletedAt is not null))
            .ToArray());

    // ---------------------------------------------------------------- создание карточки

    public async Task<Board> CreateBoardAsync(User user, CreateBoardRequest request, CancellationToken ct)
    {
        var tasks = await ResolveTasksAsync(user, request, ct);
        if (tasks.Count == 0)
            throw new InvalidOperationException("Нет задач для формирования карточки. Добавь хотя бы одну задачу.");

        if (tasks.Count > BoardFactory.MaxTasks)
            tasks = tasks.Take(BoardFactory.MaxTasks).ToList();

        var plan = BoardFactory.Plan(tasks.Count, request.Size);
        var (start, end) = BoardFactory.ResolvePeriod(request.Period, request.StartDate);
        var shuffle = request.Shuffle ?? true;
        var slots = BoardFactory.Arrange(plan, shuffle);

        var board = new Board
        {
            UserId = user.Id,
            Period = request.Period,
            Size = plan.Size,
            StartDate = start,
            EndDate = end,
            Title = string.IsNullOrWhiteSpace(request.Title) ? DefaultTitle(request.Period, start) : request.Title!.Trim(),
            Status = BoardStatus.Active
        };

        foreach (var slot in slots)
        {
            var cell = new BoardCell { Position = slot.Position };
            switch (slot.Kind)
            {
                case SlotKind.Free:
                    cell.IsFree = true;
                    cell.Title = "Свободная клетка";
                    cell.Category = "Бонус";
                    break;
                case SlotKind.Placeholder:
                    cell.IsPlaceholder = true;
                    cell.Title = "—";
                    break;
                default:
                    var task = tasks[slot.TaskIndex!.Value];
                    cell.TaskItemId = task.Id;
                    cell.Title = task.Title;
                    cell.Category = task.Category;
                    cell.Priority = task.Priority;
                    break;
            }

            board.Cells.Add(cell);
        }

        db.Boards.Add(board);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Создана карточка {BoardId} {BoardSize}x{BoardSize} на период {Period}", board.Id, board.Size, board.Size, board.Period);
        return board;
    }

    private async Task<List<TaskItem>> ResolveTasksAsync(User user, CreateBoardRequest request, CancellationToken ct)
    {
        if (request.TaskIds is { Count: > 0 })
        {
            var ids = request.TaskIds.Distinct().ToList();
            var selected = await db.Tasks
                .Where(t => t.UserId == user.Id && ids.Contains(t.Id))
                .ToListAsync(ct);
            // сохраняем порядок, в котором задачи передал клиент
            return ids.Select(id => selected.FirstOrDefault(t => t.Id == id)).Where(t => t is not null).Select(t => t!).ToList();
        }

        var all = await db.Tasks.Where(t => t.UserId == user.Id && !t.IsArchived).ToListAsync(ct);
        return all
            .OrderByDescending(t => t.Priority)
            .ThenBy(t => t.CreatedAt)
            .ToList();
    }

    public static string DefaultTitle(BoardPeriod period, DateOnly start)
    {
        var ru = new CultureInfo("ru-RU");
        return period switch
        {
            BoardPeriod.Day => $"Бинго на {start:dd.MM.yyyy}",
            BoardPeriod.Week => $"Бинго на неделю {start:dd.MM} – {start.AddDays(6):dd.MM}",
            BoardPeriod.Month => $"Бинго на {ru.DateTimeFormat.MonthNames[start.Month - 1]} {start.Year}",
            _ => $"Бинго на {start:dd.MM.yyyy}"
        };
    }

    // ---------------------------------------------------------------- отметка ячеек

    public async Task<(Board Board, ProgressResult Before, ProgressResult After, List<Achievement> New)> ToggleCellAsync(
        User user, Board board, Guid cellId, CancellationToken ct)
    {
        var cell = board.Cells.FirstOrDefault(c => c.Id == cellId)
                   ?? throw new KeyNotFoundException("Ячейка не найдена на карточке.");

        if (cell.IsPlaceholder)
            throw new InvalidOperationException("Пустая ячейка не участвует в игре.");
        if (cell.IsFree)
            throw new InvalidOperationException("Свободная ячейка отмечена автоматически.");

        var before = Progress(board);

        cell.CompletedAt = cell.CompletedAt is null ? DateTime.UtcNow : null;
        var after = Progress(board);

        if (after.IsFullCard)
        {
            board.Status = BoardStatus.Completed;
            board.CompletedAt ??= DateTime.UtcNow;
        }
        else if (board.Status == BoardStatus.Completed)
        {
            board.Status = BoardStatus.Active;
            board.CompletedAt = null;
        }

        await db.SaveChangesAsync(ct);

        var created = cell.CompletedAt is not null
            ? await RegisterAchievementsAsync(user, board, after, ct)
            : [];

        return (board, before, after, created);
    }

    // ---------------------------------------------------------------- достижения

    public static List<(AchievementKind Kind, int Metric, string Title, string Description)> Evaluate(ProgressResult progress)
    {
        var list = new List<(AchievementKind, int, string, string)>();

        if (progress.CompletedCells >= 1)
            list.Add((AchievementKind.FirstCell, 1, "Первый шаг сделан", $"Первая задача закрыта, прогресс {progress.Percent}%."));

        foreach (var line in progress.Lines.Where(l => l.IsComplete))
            list.Add((AchievementKind.Line, line.Index + 1, $"Линия №{line.Index + 1} собрана", "Полностью закрытая линия на карточке — отличный результат!"));

        if (progress.CompletedLines >= 2)
            list.Add((AchievementKind.TwoLines, 2, "Две линии собраны", "Комбинация усиливается: две линии закрыты."));

        if (progress.Percent >= 50)
            list.Add((AchievementKind.HalfCard, 50, "Половина карточки", "50% задач выполнено — это уже серьёзный прогресс."));

        if (progress.Percent >= 75)
            list.Add((AchievementKind.AlmostFull, 75, "Три четверти карточки", "75% закрыто. Осталось совсем немного."));

        if (progress.IsFullCard)
            list.Add((AchievementKind.FullCard, 100, "БИНГО! Карточка закрыта", "Все задачи выполнены. Время выбрать награду 🎉"));

        return list;
    }

    public async Task<List<Achievement>> RegisterAchievementsAsync(User user, Board board, ProgressResult progress, CancellationToken ct)
    {
        var existing = await db.Achievements
            .Where(a => a.BoardId == board.Id)
            .Select(a => new { a.Kind, a.Metric })
            .ToListAsync(ct);

        var created = new List<Achievement>();

        foreach (var candidate in Evaluate(progress))
        {
            if (existing.Any(e => e.Kind == candidate.Kind && e.Metric == candidate.Metric)) continue;

            var achievement = new Achievement
            {
                UserId = user.Id,
                BoardId = board.Id,
                Kind = candidate.Kind,
                Metric = candidate.Metric,
                Title = candidate.Title,
                Description = candidate.Description,
                Status = AchievementStatus.Suggested
            };

            db.Achievements.Add(achievement);
            created.Add(achievement);
        }

        if (created.Count == 0) return created;

        await db.SaveChangesAsync(ct);

        foreach (var achievement in created)
        {
            var isBingo = achievement.Kind == AchievementKind.FullCard;
            if (isBingo && !user.NotifyOnBingo) continue;
            if (!isBingo && !user.NotifyOnProgress) continue;

            await notifications.NotifyAsync(
                user,
                isBingo ? NotificationType.Bingo : NotificationType.Progress,
                achievement.Title,
                $"{achievement.Description} Загляни в награды — можно выбрать что-то приятное.",
                $"achievement-{achievement.Id}",
                board.Id,
                respectQuietHours: !isBingo,
                ct);
        }

        return created;
    }

    public async Task<List<Reward>> SuggestRewardsAsync(Guid userId, CancellationToken ct)
    {
        var rewards = await db.Rewards
            .Where(r => r.UserId == userId && !r.IsArchived)
            .ToListAsync(ct);

        return rewards
            .OrderBy(_ => Random.Shared.Next())
            .Take(SuggestedRewardCount)
            .ToList();
    }

    // ---------------------------------------------------------------- расположение ячеек

    public async Task ReorderAsync(Board board, IReadOnlyList<Guid> cellIdsInOrder, CancellationToken ct)
    {
        var cells = board.Cells.OrderBy(c => c.Position).ToList();
        if (cellIdsInOrder.Count != cells.Count || cellIdsInOrder.Distinct().Count() != cells.Count)
            throw new ArgumentException("Нужно передать все ячейки карточки без повторов.");
        if (cellIdsInOrder.Any(id => cells.All(c => c.Id != id)))
            throw new ArgumentException("Список содержит ячейку, которой нет на этой карточке.");

        for (var i = 0; i < cellIdsInOrder.Count; i++)
        {
            cells.First(c => c.Id == cellIdsInOrder[i]).Position = i;
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task SwapAsync(Board board, Guid cellId, Guid targetCellId, CancellationToken ct)
    {
        if (cellId == targetCellId) return;

        var cell = board.Cells.FirstOrDefault(c => c.Id == cellId) ?? throw new KeyNotFoundException("Ячейка не найдена.");
        var target = board.Cells.FirstOrDefault(c => c.Id == targetCellId) ?? throw new KeyNotFoundException("Целевая ячейка не найдена.");

        (cell.Position, target.Position) = (target.Position, cell.Position);
        await db.SaveChangesAsync(ct);
    }

    public async Task ShuffleAsync(Board board, CancellationToken ct)
    {
        var order = board.Cells.OrderBy(c => c.Position).Select(c => c.Id).ToList();
        for (var i = order.Count - 1; i > 0; i--)
        {
            var j = Random.Shared.Next(i + 1);
            (order[i], order[j]) = (order[j], order[i]);
        }

        await ReorderAsync(board, order, ct);
    }
}