using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace BingoPlanner.Tests;

/// <summary>Кубки: по одному за каждое достижение, один кубок = одна награда.</summary>
public class CupsTests
{
    private sealed class FakeTelegramSender : ITelegramSender
    {
        public bool IsConfigured => true;
        public Task<bool> SendAsync(string chatId, string text, CancellationToken ct = default) => Task.FromResult(true);
    }

    private static async Task<(AppDbContext Db, GameService Game, User User, Board Board, Reward Reward)> SeedAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"bingo-cups-{Guid.NewGuid()}")
            .Options;

        var db = new AppDbContext(options);
        var notifications = new NotificationService(db, new FakeTelegramSender(), NullLogger<NotificationService>.Instance);
        var game = new GameService(db, notifications, NullLogger<GameService>.Instance);

        var user = new User { Email = $"cups-{Guid.NewGuid():N}@bingo.local", DisplayName = "Кубки" };
        db.Users.Add(user);
        db.Tasks.AddRange(Enumerable.Range(1, 9)
            .Select(i => new TaskItem { UserId = user.Id, Title = $"Задача {i}", Category = "Тест" }));

        var reward = new Reward { UserId = user.Id, Title = "Кофе", Emoji = "☕" };
        db.Rewards.Add(reward);
        await db.SaveChangesAsync();

        var request = new CreateBoardRequest(null, BoardPeriod.Day, null, null, null, false, null);
        var board = await game.CreateBoardAsync(user, request, CancellationToken.None);
        return (db, game, user, board, reward);
    }

    [Fact]
    public async Task ToggleCell_GrantsCupImmediatelyForEveryAchievement()
    {
        var (db, game, user, board, _) = await SeedAsync();
        var cell = board.Cells.OrderBy(c => c.Position).First();

        var (_, _, _, created) = await game.ToggleCellAsync(user, board, cell.Id, CancellationToken.None);

        Assert.NotEmpty(created);
        Assert.All(created, a => Assert.Equal(AchievementStatus.Rewarded, a.Status));
        Assert.All(created, a => Assert.NotNull(a.ResolvedAt));
        Assert.Equal(created.Count, await GameService.CupsEarnedAsync(db, user.Id, CancellationToken.None));
    }

    [Fact]
    public async Task RedeemAsync_SpendsExactlyOneCupAndWritesFeedEntry()
    {
        var (db, game, user, board, reward) = await SeedAsync();
        foreach (var cell in board.Cells.OrderBy(c => c.Position).Take(3))
        {
            await game.ToggleCellAsync(user, board, cell.Id, CancellationToken.None);
        }

        var earned = await GameService.CupsEarnedAsync(db, user.Id, CancellationToken.None);
        Assert.True(earned >= 1);

        var (updated, redeemed) = await game.RedeemAsync(user, reward.Id, CancellationToken.None);

        Assert.Equal(1, updated.CupsSpent);
        Assert.Equal(reward.Id, redeemed.Id);
        Assert.Equal(earned - 1, updated.ToDto(earned).Cups);

        var notification = await db.Notifications.FirstOrDefaultAsync(n => n.UserId == user.Id && n.Type == NotificationType.Reward);
        Assert.NotNull(notification);
    }

    [Fact]
    public async Task RedeemAsync_WithoutFreeCups_Throws()
    {
        var (_, game, user, _, reward) = await SeedAsync();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => game.RedeemAsync(user, reward.Id, CancellationToken.None));

        Assert.Contains("кубк", error.Message);
    }

    [Fact]
    public async Task RedeemAsync_UnknownReward_Throws()
    {
        var (_, game, user, _, _) = await SeedAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => game.RedeemAsync(user, Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task RedeemAsync_ArchivedReward_Throws()
    {
        var (db, game, user, board, reward) = await SeedAsync();
        var cell = board.Cells.OrderBy(c => c.Position).First();
        await game.ToggleCellAsync(user, board, cell.Id, CancellationToken.None);

        reward.IsArchived = true;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => game.RedeemAsync(user, reward.Id, CancellationToken.None));
    }
}