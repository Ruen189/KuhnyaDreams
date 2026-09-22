using System.Security.Claims;
using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Endpoints;

public static class NotificationEndpoints
{
    public static void MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/notifications").WithTags("Notifications").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct, int take = 50, bool unreadOnly = false) =>
        {
            var userId = principal.GetUserId();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null) return Results.NotFound();

            if (!user.InAppEnabled)
                return Results.Ok(new NotificationFeedDto(0, []));

            var query = db.Notifications.Where(n => n.UserId == userId);
            if (unreadOnly) query = query.Where(n => n.ReadAt == null);

            var items = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(Math.Clamp(take, 1, 200))
                .ToListAsync(ct);

            var unread = await db.Notifications.CountAsync(n => n.UserId == userId && n.ReadAt == null, ct);
            return Results.Ok(new NotificationFeedDto(unread, items.Select(n => n.ToDto()).ToList()));
        })
        .WithSummary("Лента уведомлений и счётчик непрочитанных");

        group.MapPost("/{id:guid}/read", async (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var notification = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == principal.GetUserId(), ct);
            if (notification is null) return Results.NotFound();

            notification.ReadAt ??= DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(notification.ToDto());
        })
        .WithSummary("Отметить уведомление прочитанным");

        group.MapPost("/read-all", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            var unread = await db.Notifications.Where(n => n.UserId == userId && n.ReadAt == null).ToListAsync(ct);
            foreach (var notification in unread) notification.ReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { read = unread.Count });
        })
        .WithSummary("Отметить всю ленту прочитанной");

        group.MapDelete("/", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            var items = await db.Notifications.Where(n => n.UserId == userId).ToListAsync(ct);
            db.Notifications.RemoveRange(items);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .WithSummary("Очистить ленту уведомлений");

        group.MapPost("/telegram/test", async (TelegramTestRequest request, ClaimsPrincipal principal, AppDbContext db, ITelegramSender telegram, CancellationToken ct) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == principal.GetUserId(), ct);
            if (user is null) return Results.NotFound();

            var chatId = string.IsNullOrWhiteSpace(request.ChatId) ? user.TelegramChatId : request.ChatId.Trim();
            if (string.IsNullOrWhiteSpace(chatId))
                return Results.BadRequest(new { error = "Укажите Telegram chat id." });

            if (!telegram.IsConfigured)
            {
                return Results.Ok(new TelegramTestResult(false,
                    "Telegram-бот не настроен: задайте Telegram:BotToken в appsettings или переменной окружения Telegram__BotToken. " +
                    "В прототипе вместо этого работает in-app лента уведомлений."));
            }

            user.TelegramChatId = chatId;
            user.TelegramEnabled = true;
            await db.SaveChangesAsync(ct);

            var sent = await telegram.SendAsync(chatId, "<b>Бинго-планировщик</b>\nПроверка связи: уведомления подключены 🎉", ct);
            return Results.Ok(new TelegramTestResult(sent, sent ? "Сообщение отправлено." : "Не удалось отправить сообщение — проверьте chat id и токен бота."));
        })
        .WithSummary("Проверить интеграцию с Telegram");

        group.MapPost("/run-checks", async (IServiceScopeFactory scopeFactory, CancellationToken ct) =>
        {
            var created = await PeriodNotifier.RunChecksAsync(scopeFactory, ct);
            return Results.Ok(new { created });
        })
        .WithSummary("Принудительно выполнить фоновые проверки (демо: старт периода, приближение к линии)");
    }
}