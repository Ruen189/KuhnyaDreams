using System.Security.Claims;
using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Endpoints;

public static class RewardEndpoints
{
    public static void MapRewardEndpoints(this IEndpointRouteBuilder app)
    {
        var rewards = app.MapGroup("/api/rewards").WithTags("Rewards").RequireAuthorization();

        rewards.MapGet("/", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct, bool includeArchived = false) =>
        {
            var userId = principal.GetUserId();
            var query = db.Rewards.Where(r => r.UserId == userId);
            if (!includeArchived) query = query.Where(r => !r.IsArchived);

            var items = await query.OrderBy(r => r.CreatedAt).ToListAsync(ct);
            return Results.Ok(items.Select(r => r.ToDto()).ToList());
        })
        .WithSummary("Список личных наград");

        rewards.MapPost("/", async (UpsertRewardRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Title))
                return Results.BadRequest(new { error = "Название награды обязательно." });

            var reward = new Reward
            {
                UserId = principal.GetUserId(),
                Title = request.Title.Trim(),
                Description = request.Description,
                Emoji = string.IsNullOrWhiteSpace(request.Emoji) ? "🎁" : request.Emoji!.Trim()
            };

            db.Rewards.Add(reward);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/rewards/{reward.Id}", reward.ToDto());
        })
        .WithSummary("Добавить награду");

        rewards.MapPut("/{id:guid}", async (Guid id, UpsertRewardRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var reward = await db.Rewards.FirstOrDefaultAsync(r => r.Id == id && r.UserId == principal.GetUserId(), ct);
            if (reward is null) return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(request.Title)) reward.Title = request.Title.Trim();
            reward.Description = request.Description ?? reward.Description;
            if (!string.IsNullOrWhiteSpace(request.Emoji)) reward.Emoji = request.Emoji!.Trim();
            if (request.IsArchived is not null) reward.IsArchived = request.IsArchived.Value;

            await db.SaveChangesAsync(ct);
            return Results.Ok(reward.ToDto());
        })
        .WithSummary("Обновить награду");

        rewards.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var reward = await db.Rewards.FirstOrDefaultAsync(r => r.Id == id && r.UserId == principal.GetUserId(), ct);
            if (reward is null) return Results.NotFound();

            db.Rewards.Remove(reward);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .WithSummary("Удалить награду");

        MapAchievementEndpoints(app);
    }

    private static void MapAchievementEndpoints(IEndpointRouteBuilder app)
    {
        var achievements = app.MapGroup("/api/achievements").WithTags("Achievements").RequireAuthorization();

        achievements.MapGet("/", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct, AchievementStatus? status = null, Guid? boardId = null) =>
        {
            var userId = principal.GetUserId();
            var query = db.Achievements.Where(a => a.UserId == userId);
            if (status is not null) query = query.Where(a => a.Status == status);
            if (boardId is not null) query = query.Where(a => a.BoardId == boardId);

            var items = await query.OrderByDescending(a => a.UnlockedAt).Take(200).ToListAsync(ct);
            var boardIds = items.Select(a => a.BoardId).Distinct().ToList();
            var titles = await db.Boards.Where(b => boardIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Title, ct);
            var rewardIds = items.Where(a => a.RewardId is not null).Select(a => a.RewardId!.Value).Distinct().ToList();
            var rewards = await db.Rewards.Where(r => rewardIds.Contains(r.Id)).ToDictionaryAsync(r => r.Id, ct);

            return Results.Ok(items
                .Select(a => a.ToDto(titles.GetValueOrDefault(a.BoardId, "Карточка"), a.RewardId is Guid rid ? rewards.GetValueOrDefault(rid) : null))
                .ToList());
        })
        .WithSummary("Достижения пользователя (в том числе ожидающие награды)");

        achievements.MapPost("/{id:guid}/resolve", async (Guid id, ResolveAchievementRequest request, ClaimsPrincipal principal, AppDbContext db, NotificationService notifications, CancellationToken ct) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == principal.GetUserId(), ct);
            var achievement = await db.Achievements.FirstOrDefaultAsync(a => a.Id == id && a.UserId == principal.GetUserId(), ct);
            if (user is null || achievement is null) return Results.NotFound();

            Reward? reward;
            if (request.Skip)
            {
                achievement.Status = AchievementStatus.Skipped;
                achievement.RewardId = null;
                reward = null;
            }
            else
            {
                if (request.RewardId is null)
                    return Results.BadRequest(new { error = "Нужно выбрать награду или пропустить." });

                reward = await db.Rewards.FirstOrDefaultAsync(r => r.Id == request.RewardId && r.UserId == user.Id, ct);
                if (reward is null) return Results.NotFound(new { error = "Награда не найдена." });

                achievement.RewardId = reward.Id;
                achievement.Status = AchievementStatus.Rewarded;
            }

            achievement.ResolvedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            var board = await db.Boards.FirstOrDefaultAsync(b => b.Id == achievement.BoardId, ct);
            var body = request.Skip
                ? "Ты решил не брать награду — тоже вариант. Главное, что прогресс уже есть."
                : $"Награда «{reward!.Title}» закреплена за достижением «{achievement.Title}». Обязательно отметь свой успех!";

            await notifications.NotifyAsync(
                user,
                NotificationType.Reward,
                request.Skip ? "Достижение отмечено" : "Награда выбрана",
                body,
                $"achievement-resolved-{achievement.Id}",
                achievement.BoardId,
                respectQuietHours: false,
                ct);

            return Results.Ok(achievement.ToDto(board?.Title ?? "Карточка", reward));
        })
        .WithSummary("Выбрать награду за достижение или пропустить");
    }
}