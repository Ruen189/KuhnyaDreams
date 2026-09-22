using System.Security.Claims;
using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Endpoints;

public static class StatsEndpoints
{
    public static void MapStatsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/stats").WithTags("Stats").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct, int days = 30) =>
        {
            var userId = principal.GetUserId();
            days = Math.Clamp(days, 7, 180);

            var boards = await db.Boards.Include(b => b.Cells).Where(b => b.UserId == userId).ToListAsync(ct);
            var achievements = await db.Achievements.Where(a => a.UserId == userId).ToListAsync(ct);
            var tasks = await db.Tasks.Where(t => t.UserId == userId).ToListAsync(ct);

            var cells = boards.SelectMany(b => b.Cells).ToList();
            var completedCells = cells.Where(c => c.CompletedAt is not null).ToList();
            var completedDates = completedCells
                .Select(c => DateOnly.FromDateTime(c.CompletedAt!.Value))
                .Distinct()
                .OrderBy(d => d)
                .ToList();

            var today = DateOnly.FromDateTime(DateTime.Today);
            var (current, longest) = ComputeStreaks(completedDates, today);

            var dailyFrom = today.AddDays(-(days - 1));
            var daily = Enumerable.Range(0, days)
                .Select(offset => dailyFrom.AddDays(offset))
                .Select(date => new DailyStatDto(date, completedCells.Count(c => DateOnly.FromDateTime(c.CompletedAt!.Value) == date)))
                .ToList();

            var categories = cells
                .Where(c => !c.IsPlaceholder && c.Category is not null)
                .GroupBy(c => c.Category!)
                .Select(g => new CategoryStatDto(g.Key, g.Count(c => c.CompletedAt is not null), g.Count()))
                .OrderByDescending(c => c.Completed)
                .ThenBy(c => c.Category)
                .ToList();

            var summary = new StatsSummaryDto(
                TotalTasks: tasks.Count,
                CompletedCells: completedCells.Count,
                ActiveBoards: boards.Count(b => b.Status == BoardStatus.Active),
                CompletedBoards: boards.Count(b => b.Status == BoardStatus.Completed),
                LinesCollected: achievements.Count(a => a.Kind == AchievementKind.Line),
                BingosCollected: achievements.Count(a => a.Kind == AchievementKind.FullCard),
                RewardsRedeemed: achievements.Count(a => a.Status == AchievementStatus.Rewarded),
                CurrentStreakDays: current,
                LongestStreakDays: longest);

            var history = boards
                .OrderByDescending(b => b.StartDate)
                .ThenByDescending(b => b.CreatedAt)
                .Take(50)
                .Select(b => b.ToSummary(GameService.Progress(b)))
                .ToList();

            return Results.Ok(new StatsResponse(summary, daily, categories, history));
        })
        .WithSummary("Сводная статистика, активность по дням, категории и история карточек");
    }

    public static (int Current, int Longest) ComputeStreaks(IReadOnlyList<DateOnly> days, DateOnly today)
    {
        if (days.Count == 0) return (0, 0);

        var longest = 1;
        var run = 1;
        for (var i = 1; i < days.Count; i++)
        {
            run = days[i] == days[i - 1].AddDays(1) ? run + 1 : 1;
            longest = Math.Max(longest, run);
        }

        var current = 0;
        var cursor = days[^1];
        if (cursor == today || cursor == today.AddDays(-1))
        {
            current = 1;
            for (var i = days.Count - 1; i > 0; i--)
            {
                if (days[i - 1] == days[i].AddDays(-1)) current++;
                else break;
            }
        }

        return (current, longest);
    }
}