using System.Net.Http.Json;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Services;

public interface ITelegramSender
{
    bool IsConfigured { get; }
    Task<bool> SendAsync(string chatId, string text, CancellationToken ct = default);
}

/// <summary>
/// Отправка сообщений через Telegram Bot API.
/// Если токен бота не задан в конфигурации (Telegram:BotToken), отправка пропускается без ошибок —
/// прототип полностью работоспособен и без Telegram.
/// </summary>
public class TelegramSender : ITelegramSender
{
    private readonly HttpClient _http;
    private readonly ILogger<TelegramSender> _logger;
    private readonly string _botToken;

    public TelegramSender(HttpClient http, IConfiguration configuration, ILogger<TelegramSender> logger)
    {
        _http = http;
        _logger = logger;
        _botToken = configuration["Telegram:BotToken"] ?? string.Empty;
        _http.Timeout = TimeSpan.FromSeconds(10);
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_botToken);

    public async Task<bool> SendAsync(string chatId, string text, CancellationToken ct = default)
    {
        if (!IsConfigured)
        {
            _logger.LogInformation("Telegram не настроен (Telegram:BotToken пуст) — сообщение для chat {ChatId} пропущено: {Text}", chatId, text);
            return false;
        }

        try
        {
            var response = await _http.PostAsJsonAsync(
                $"https://api.telegram.org/bot{_botToken}/sendMessage",
                new { chat_id = chatId, text, parse_mode = "HTML" },
                ct);

            if (response.IsSuccessStatusCode) return true;

            var payload = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Telegram вернул {Status}: {Payload}", response.StatusCode, payload);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Не удалось отправить сообщение в Telegram");
            return false;
        }
    }
}

/// <summary>
/// Единая точка отправки уведомлений: in-app лента + Telegram.
/// </summary>
public class NotificationService(AppDbContext db, ITelegramSender telegram, ILogger<NotificationService> logger)
{
    public async Task<Notification?> NotifyAsync(
        User user,
        NotificationType type,
        string title,
        string body,
        string dedupeKey,
        Guid? boardId = null,
        bool respectQuietHours = true,
        CancellationToken ct = default)
    {
        if (!user.InAppEnabled && !user.TelegramEnabled) return null;

        var exists = await db.Notifications.AnyAsync(n => n.UserId == user.Id && n.DedupeKey == dedupeKey, ct);
        if (exists) return null;

        var notification = new Notification
        {
            UserId = user.Id,
            BoardId = boardId,
            Type = type,
            Title = title,
            Body = body,
            DedupeKey = dedupeKey
        };

        var canSendNow = !respectQuietHours || !InQuietHours(user, DateTime.Now);
        if (user.TelegramEnabled && !string.IsNullOrWhiteSpace(user.TelegramChatId) && canSendNow)
        {
            notification.SentToTelegram = await telegram.SendAsync(
                user.TelegramChatId!,
                $"<b>{title}</b>\n{body}",
                ct);
        }

        db.Notifications.Add(notification);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Уведомление [{Type}] для {Email}: {Title}", type, user.Email, title);
        return notification;
    }

    public static bool InQuietHours(User user, DateTime localNow)
    {
        var start = Math.Clamp(user.QuietHoursStart, 0, 23);
        var end = Math.Clamp(user.QuietHoursEnd, 0, 23);
        if (start == end) return false;
        var hour = localNow.Hour;
        return start < end ? hour >= start && hour < end : hour >= start || hour < end;
    }
}