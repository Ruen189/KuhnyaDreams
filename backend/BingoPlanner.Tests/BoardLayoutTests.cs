using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BingoPlanner.Tests;

/// <summary>
/// Проверки раскладки ячеек на настоящей реляционной БД (SQLite): уникальный индекс
/// {BoardId, Position} не позволял менять позиции одним SaveChanges — был 500 на «Перемешать».
/// </summary>
public class BoardLayoutTests
{
    private sealed class SilentTelegramSender : ITelegramSender
    {
        public bool IsConfigured => false;
        public Task<bool> SendAsync(string chatId, string text, CancellationToken ct = default) => Task.FromResult(false);
    }

    private static async Task<(AppDbContext Db, GameService Game, User User, Board Board)> SeedAsync(int taskCount, bool shuffle = false)
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var user = new User { Email = $"layout-{Guid.NewGuid():N}@bingo.local", DisplayName = "Раскладка" };
        db.Users.Add(user);
        db.Tasks.AddRange(Enumerable.Range(1, taskCount)
            .Select(i => new TaskItem { UserId = user.Id, Title = $"Задача {i}", Category = "Тест" }));
        await db.SaveChangesAsync();

        var notifications = new NotificationService(db, new SilentTelegramSender(), NullLogger<NotificationService>.Instance);
        var game = new GameService(db, notifications, NullLogger<GameService>.Instance);
        var request = new CreateBoardRequest(null, BoardPeriod.Day, null, null, null, shuffle, null);
        var board = await game.CreateBoardAsync(user, request, CancellationToken.None);

        return (db, game, user, board);
    }

    private static async Task AssertPositionsAreCleanGridAsync(AppDbContext db, Guid boardId)
    {
        var positions = await db.BoardCells
            .Where(c => c.BoardId == boardId)
            .Select(c => c.Position)
            .ToListAsync();

        Assert.Equal(Enumerable.Range(0, positions.Count).ToList(), positions.OrderBy(p => p).ToList());
    }

    [Fact]
    public async Task ShuffleAsync_PermutesPositionsWithoutBreakingUniqueIndex()
    {
        var (db, game, _, board) = await SeedAsync(9);

        await game.ShuffleAsync(board, CancellationToken.None);

        await AssertPositionsAreCleanGridAsync(db, board.Id);
        Assert.Equal(9, board.Cells.Count);
    }

    [Fact]
    public async Task ReorderAsync_ReversedOrder_KeepsEveryPositionOnce()
    {
        var (db, game, _, board) = await SeedAsync(9);
        var reversed = board.Cells.OrderByDescending(c => c.Position).Select(c => c.Id).ToList();

        await game.ReorderAsync(board, reversed, CancellationToken.None);

        await AssertPositionsAreCleanGridAsync(db, board.Id);
        for (var i = 0; i < reversed.Count; i++)
        {
            Assert.Equal(i, board.Cells.Single(c => c.Id == reversed[i]).Position);
        }
    }

    [Fact]
    public async Task ReorderAsync_RotateByOne_KeepsEveryPositionOnce()
    {
        // Сдвиг на одну ячейку меняет позиции почти у всех строк — самый частый случай при перетаскивании.
        var (db, game, _, board) = await SeedAsync(9);
        var order = board.Cells.OrderBy(c => c.Position).Select(c => c.Id).ToList();
        order.Add(order[0]);
        order.RemoveAt(0);

        await game.ReorderAsync(board, order, CancellationToken.None);

        await AssertPositionsAreCleanGridAsync(db, board.Id);
    }

    [Fact]
    public async Task SwapAsync_ExchangesTwoCells()
    {
        var (db, game, _, board) = await SeedAsync(9);
        var first = board.Cells.OrderBy(c => c.Position).First();
        var last = board.Cells.OrderBy(c => c.Position).Last();

        await game.SwapAsync(board, first.Id, last.Id, CancellationToken.None);

        await AssertPositionsAreCleanGridAsync(db, board.Id);
        // Обмен местами: первая клетка встаёт на последнюю позицию и наоборот.
        Assert.Equal(0, last.Position);
        Assert.Equal(board.Cells.Count - 1, first.Position);
    }

    [Fact]
    public async Task ShuffleAsync_KeepsCompletedCellsAttachedToTheirTasks()
    {
        var (db, game, user, board) = await SeedAsync(9);
        var target = board.Cells.OrderBy(c => c.Position).First();
        var targetTaskId = target.TaskItemId;

        await game.ToggleCellAsync(user, board, target.Id, CancellationToken.None);
        await game.ShuffleAsync(board, CancellationToken.None);

        var afterShuffle = await db.BoardCells.AsNoTracking().SingleAsync(c => c.Id == target.Id);
        Assert.Equal(targetTaskId, afterShuffle.TaskItemId);
        Assert.NotNull(afterShuffle.CompletedAt);
    }
}