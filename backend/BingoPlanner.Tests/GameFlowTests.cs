using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BingoPlanner.Tests;

/// <summary>Сквозные проверки игрового сервиса на in-memory БД: карточка, отметки, достижения, награды.</summary>
public class GameFlowTests
{
    private sealed class FakeTelegramSender : ITelegramSender
    {
        public List<string> Sent { get; } = [];
        public bool IsConfigured => true;
        public Task<bool> SendAsync(string chatId, string text, CancellationToken ct = default)
        {
            Sent.Add(text);
            return Task.FromResult(true);
        }
    }

    private static (AppDbContext Db, GameService Game, FakeTelegramSender Telegram) CreateServices()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"bingo-tests-{Guid.NewGuid()}")
            .Options;

        var db = new AppDbContext(options);
        var telegram = new FakeTelegramSender();
        var notifications = new NotificationService(db, telegram, NullLogger<NotificationService>.Instance);
        var game = new GameService(db, notifications, NullLogger<GameService>.Instance);
        return (db, game, telegram);
    }

    private static async Task<(AppDbContext Db, GameService Game, User User, List<TaskItem> Tasks)> SeedAsync(int taskCount)
    {
        var (db, game, _) = CreateServices();
        var user = new User { Email = "unit@bingo.local", DisplayName = "Тест" };
        db.Users.Add(user);

        var tasks = Enumerable.Range(1, taskCount)
            .Select(i => new TaskItem { UserId = user.Id, Title = $"Задача {i}", Category = "Тест" })
            .ToList();

        db.Tasks.AddRange(tasks);
        await db.SaveChangesAsync();
        return (db, game, user, tasks);
    }

    private static CreateBoardRequest Request(int? size = null, bool shuffle = false) =>
        new(Title: null, Period: BoardPeriod.Day, StartDate: null, Size: size, TaskIds: null, Shuffle: shuffle, UseAllActiveTasks: null);

    [Fact]
    public async Task CreateBoard_FillsEveryCell_WhenTasksExactlyFillGrid()
    {
        var (_, game, user, _) = await SeedAsync(9);

        var board = await game.CreateBoardAsync(user, Request(), CancellationToken.None);

        Assert.Equal(3, board.Size);
        Assert.Equal(9, board.Cells.Count);
        Assert.All(board.Cells, cell => Assert.False(cell.IsPlaceholder));
        Assert.DoesNotContain(board.Cells, cell => cell.IsFree);
        Assert.Equal(0, GameService.Progress(board).CompletedCells);
    }

    [Fact]
    public async Task CreateBoard_PutsFreeCellInCenter_WhenOneCellRemains()
    {
        var (_, game, user, _) = await SeedAsync(8);

        var board = await game.CreateBoardAsync(user, Request(), CancellationToken.None);

        var free = Assert.Single(board.Cells, c => c.IsFree);
        Assert.Equal(4, free.Position);
        Assert.Equal(1, GameService.Progress(board).CompletedCells); // свободная клетка уже «выполнена»
    }

    [Fact]
    public async Task ToggleCell_SecondClick_UnmarksCell()
    {
        var (db, game, user, _) = await SeedAsync(9);
        var board = await game.CreateBoardAsync(user, Request(), CancellationToken.None);
        var cell = board.Cells.OrderBy(c => c.Position).First();

        var (_, _, after, created) = await game.ToggleCellAsync(user, board, cell.Id, CancellationToken.None);
        Assert.Equal(1, after.CompletedCells);
        Assert.Contains(created, a => a.Kind == AchievementKind.FirstCell);

        await game.ToggleCellAsync(user, board, cell.Id, CancellationToken.None);
        db.ChangeTracker.Clear();
        var stored = await db.Boards.Include(b => b.Cells).FirstAsync(b => b.Id == board.Id);
        Assert.Equal(0, GameService.Progress(stored).CompletedCells);
    }

    [Fact]
    public async Task CreateBoard_RejectsEmptyTaskList()
    {
        var (db, game, user, tasks) = await SeedAsync(1);
        tasks[0].IsArchived = true;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            game.CreateBoardAsync(user, Request(), CancellationToken.None));
    }

    [Fact]
    public async Task ToggleCell_CompletingRow_UnlocksLineAchievementWithRewardSuggestion()
    {
        var (db, game, user, _) = await SeedAsync(9);
        db.Rewards.AddRange(
            new Reward { UserId = user.Id, Title = "Кофе" },
            new Reward { UserId = user.Id, Title = "Сериал" },
            new Reward { UserId = user.Id, Title = "Ванна" },
            new Reward { UserId = user.Id, Title = "Книга" });
        await db.SaveChangesAsync();

        var board = await game.CreateBoardAsync(user, Request(), CancellationToken.None);
        var topRow = board.Cells.Where(c => c.Position < 3).OrderBy(c => c.Position).ToList();

        List<Achievement> created = [];
        foreach (var cell in topRow)
        {
            var result = await game.ToggleCellAsync(user, board, cell.Id, CancellationToken.None);
            created = result.New;
        }

        Assert.Contains(created, a => a.Kind == AchievementKind.Line && a.Metric == 1);
        Assert.NotEqual(BoardStatus.Completed, board.Status);

        var suggestions = await game.SuggestRewardsAsync(user.Id, CancellationToken.None);
        Assert.Equal(GameService.SuggestedRewardCount, suggestions.Count);
    }

    [Fact]
    public async Task ToggleCell_CompletingWholeCard_MarksBoardCompletedAndSendsNotification()
    {
        var (db, game, user, _) = await SeedAsync(9);
        var board = await game.CreateBoardAsync(user, Request(), CancellationToken.None);

        foreach (var cell in board.Cells.OrderBy(c => c.Position))
        {
            await game.ToggleCellAsync(user, board, cell.Id, CancellationToken.None);
        }

        var progress = GameService.Progress(board);
        Assert.True(progress.IsFullCard);
        Assert.True(progress.HasBingo);
        Assert.Equal(100, progress.Percent);
        Assert.Equal(BoardStatus.Completed, board.Status);
        Assert.NotNull(board.CompletedAt);

        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.BoardId == board.Id && n.Type == NotificationType.Bingo);
        Assert.NotNull(notification);
    }

    [Fact]
    public async Task ToggleCell_RejectsFreeAndUnknownCells()
    {
        var (_, game, user, _) = await SeedAsync(8);
        var board = await game.CreateBoardAsync(user, Request(), CancellationToken.None);

        var free = board.Cells.Single(c => c.IsFree);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            game.ToggleCellAsync(user, board, free.Id, CancellationToken.None));
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            game.ToggleCellAsync(user, board, Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task Reorder_MovesCellsToRequestedOrder()
    {
        var (_, game, user, _) = await SeedAsync(9);
        var board = await game.CreateBoardAsync(user, Request(), CancellationToken.None);

        var reversed = board.Cells.OrderByDescending(c => c.Position).Select(c => c.Id).ToList();
        await game.ReorderAsync(board, reversed, CancellationToken.None);

        for (var i = 0; i < reversed.Count; i++)
        {
            Assert.Equal(i, board.Cells.Single(c => c.Id == reversed[i]).Position);
        }
    }

    [Fact]
    public async Task Reorder_RejectsIncompleteList()
    {
        var (_, game, user, _) = await SeedAsync(9);
        var board = await game.CreateBoardAsync(user, Request(), CancellationToken.None);
        var ids = board.Cells.Select(c => c.Id).Take(3).ToList();

        await Assert.ThrowsAsync<ArgumentException>(() => game.ReorderAsync(board, ids, CancellationToken.None));
    }
}