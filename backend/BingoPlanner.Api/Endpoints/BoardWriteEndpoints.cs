using System.Security.Claims;
using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Endpoints;

public static partial class BoardEndpoints
{
    private static void MapWriteEndpoints(RouteGroupBuilder group)
    {
        group.MapPost("/", async (CreateBoardRequest request, ClaimsPrincipal principal, AppDbContext db, GameService game, CancellationToken ct) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == principal.GetUserId(), ct);
            if (user is null) return Results.NotFound();

            try
            {
                var board = await game.CreateBoardAsync(user, request, ct);
                return Results.Created($"/api/boards/{board.Id}", await BuildDtoAsync(db, board, ct));
            }
            catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        })
        .WithSummary("Сформировать карточку бинго из списка задач");

        group.MapPost("/{id:guid}/cells/{cellId:guid}/toggle", async (Guid id, Guid cellId, ClaimsPrincipal principal, AppDbContext db, GameService game, CancellationToken ct) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == principal.GetUserId(), ct);
            var board = await LoadBoardAsync(db, principal.GetUserId(), id, ct);
            if (user is null || board is null) return Results.NotFound();

            try
            {
                var (updated, before, _ , created) = await game.ToggleCellAsync(user, board, cellId, ct);

                var rewardIds = created.Where(a => a.RewardId is not null).Select(a => a.RewardId!.Value).Distinct().ToList();
                var rewards = await db.Rewards.Where(r => rewardIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);
                var suggested = created.Count > 0 ? await game.SuggestRewardsAsync(user.Id, ct) : [];

                return Results.Ok(new ToggleCellResponse(
                    await BuildDtoAsync(db, updated, ct),
                    created.Select(a => a.ToDto(updated.Title, a.RewardId is Guid rid && rewards.TryGetValue(rid, out var r) ? r : null)).ToList(),
                    suggested.Select(r => r.ToDto()).ToList(),
                    before.ToDto()));
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        })
        .WithSummary("Отметить/снять ячейку и получить новые достижения");

        group.MapPut("/{id:guid}/layout", async (Guid id, ReorderBoardRequest request, ClaimsPrincipal principal, AppDbContext db, GameService game, CancellationToken ct) =>
        {
            var board = await LoadBoardAsync(db, principal.GetUserId(), id, ct);
            if (board is null) return Results.NotFound();

            try
            {
                await game.ReorderAsync(board, request.CellIdsInOrder ?? [], ct);
                return Results.Ok(await BuildDtoAsync(db, board, ct));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        })
        .WithSummary("Изменить расположение ячеек (перетаскиванием)");

        group.MapPost("/{id:guid}/cells/swap", async (Guid id, SwapCellsRequest request, ClaimsPrincipal principal, AppDbContext db, GameService game, CancellationToken ct) =>
        {
            var board = await LoadBoardAsync(db, principal.GetUserId(), id, ct);
            if (board is null) return Results.NotFound();

            try
            {
                await game.SwapAsync(board, request.CellId, request.TargetCellId, ct);
                return Results.Ok(await BuildDtoAsync(db, board, ct));
            }
            catch (KeyNotFoundException ex)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        })
        .WithSummary("Поменять две ячейки местами");

        group.MapPost("/{id:guid}/shuffle", async (Guid id, ClaimsPrincipal principal, AppDbContext db, GameService game, CancellationToken ct) =>
        {
            var board = await LoadBoardAsync(db, principal.GetUserId(), id, ct);
            if (board is null) return Results.NotFound();

            await game.ShuffleAsync(board, ct);
            return Results.Ok(await BuildDtoAsync(db, board, ct));
        })
        .WithSummary("Перемешать ячейки карточки");

        group.MapPatch("/{id:guid}/status", async (Guid id, BoardStatus status, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var board = await LoadBoardAsync(db, principal.GetUserId(), id, ct);
            if (board is null) return Results.NotFound();

            board.Status = status;
            await db.SaveChangesAsync(ct);
            return Results.Ok(await BuildDtoAsync(db, board, ct));
        })
        .WithSummary("Изменить статус карточки (активна/архив)");

        group.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var board = await db.Boards.FirstOrDefaultAsync(b => b.Id == id && b.UserId == principal.GetUserId(), ct);
            if (board is null) return Results.NotFound();

            db.Boards.Remove(board);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .WithSummary("Удалить карточку");
    }
}