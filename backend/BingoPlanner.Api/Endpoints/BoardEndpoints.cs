using System.Security.Claims;
using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Endpoints;

public static partial class BoardEndpoints
{
    public static void MapBoardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/boards").WithTags("Boards").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct, BoardPeriod? period = null, BoardStatus? status = null, int take = 50) =>
        {
            var userId = principal.GetUserId();
            var query = db.Boards.Include(b => b.Cells).Where(b => b.UserId == userId);
            if (period is not null) query = query.Where(b => b.Period == period);
            if (status is not null) query = query.Where(b => b.Status == status);

            var boards = await query
                .OrderByDescending(b => b.StartDate)
                .ThenByDescending(b => b.CreatedAt)
                .Take(Math.Clamp(take, 1, 200))
                .ToListAsync(ct);

            return Results.Ok(boards.Select(b => b.ToSummary(GameService.Progress(b))).ToList());
        })
        .WithSummary("История карточек с прогрессом");

        group.MapGet("/current", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct, BoardPeriod? period = null) =>
        {
            var userId = principal.GetUserId();
            var today = DateOnly.FromDateTime(DateTime.Today);

            var boards = await db.Boards
                .Include(b => b.Cells)
                .Where(b => b.UserId == userId && b.Status == BoardStatus.Active && b.StartDate <= today && b.EndDate >= today)
                .ToListAsync(ct);

            if (period is not null) boards = boards.Where(b => b.Period == period).ToList();
            if (boards.Count == 0) return Results.Ok(new List<BoardDto>());

            var result = new List<BoardDto>();
            foreach (var board in boards.OrderBy(b => b.Period))
            {
                result.Add(await BuildDtoAsync(db, board, ct));
            }

            return Results.Ok(result);
        })
        .WithSummary("Карточки, активные прямо сейчас (день/неделя/месяц)");

        group.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var board = await LoadBoardAsync(db, principal.GetUserId(), id, ct);
            return board is null ? Results.NotFound() : Results.Ok(await BuildDtoAsync(db, board, ct));
        })
        .WithSummary("Карточка целиком с ячейками, прогрессом и достижениями");

        MapWriteEndpoints(group);
    }

    internal static async Task<Board?> LoadBoardAsync(AppDbContext db, Guid userId, Guid boardId, CancellationToken ct) =>
        await db.Boards
            .Include(b => b.Cells).ThenInclude(c => c.TaskItem)
            .FirstOrDefaultAsync(b => b.Id == boardId && b.UserId == userId, ct);

    internal static async Task<BoardDto> BuildDtoAsync(AppDbContext db, Board board, CancellationToken ct)
    {
        var progress = GameService.Progress(board);
        var achievements = await db.Achievements
            .Where(a => a.BoardId == board.Id)
            .OrderBy(a => a.UnlockedAt)
            .ToListAsync(ct);

        var rewardIds = achievements.Where(a => a.RewardId is not null).Select(a => a.RewardId!.Value).Distinct().ToList();
        var rewards = await db.Rewards.Where(r => rewardIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);

        return board.ToDto(progress, achievements, rewards);
    }
}