using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Services;

/// <summary>
/// Периодические проверки: старт нового периода, приближение к линии и напоминания
/// о заканчивающемся периоде. Работает мягко — не чаще одного сообщения в день на событие.
/// </summary>
public class PeriodNotifier(IServiceScopeFactory scopeFactory, IConfiguration configuration, ILogger<PeriodNotifier> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var minutes = int.TryParse(configuration["Notifications:CheckIntervalMinutes"], out var value) ? Math.Max(1, value) : 5;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(minutes));

        // Даём приложению полностью подняться перед первой проверкой.
        try { await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken); }
        catch (OperationCanceledException) { return; }

        do
        {
            try
            {
                var created = await RunChecksAsync(scopeFactory, stoppingToken);
                if (created > 0) logger.LogInformation("Фоновая проверка создала {Count} уведомлений", created);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Ошибка фоновой проверки уведомлений");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>Ручной запуск проверок — используется демо-сценарием и тестами.</summary>
    public static async Task<int> RunChecksAsync(IServiceScopeFactory scopeFactory, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<NotificationService>();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var users = await db.Users.ToListAsync(ct);
        var created = 0;

        foreach (var user in users)
        {
            var boards = await db.Boards
                .Include(b => b.Cells)
                .Where(b => b.UserId == user.Id && b.Status != BoardStatus.Archived)
                .ToListAsync(ct);

            foreach (var board in boards)
            {
                if (user.NotifyOnPeriodStart && board.StartDate == today)
                {
                    var result = await notifications.NotifyAsync(
                        user,
                        NotificationType.PeriodStart,
                        "Новый период начался",
                        $"Карточка «{board.Title}» активна до {board.EndDate:dd.MM.yyyy}. Загляни, когда будет удобно — спешки нет.",
                        $"period-start-{board.Id}-{today:yyyyMMdd}",
                        board.Id,
                        respectQuietHours: true,
                        ct);
                    if (result is not null) created++;
                }

                if (board.Status != BoardStatus.Active) continue;

                var progress = GameService.Progress(board);

                if (user.NotifyOnProgress && progress.CellsToNextLine == 1 && !progress.IsFullCard)
                {
                    var result = await notifications.NotifyAsync(
                        user,
                        NotificationType.NearBingo,
                        "Один шаг до линии",
                        $"На карточке «{board.Title}» для линии не хватает всего одной ячейки. Отметь её, когда получится.",
                        $"near-bingo-{board.Id}-{today:yyyyMMdd}",
                        board.Id,
                        respectQuietHours: true,
                        ct);
                    if (result is not null) created++;
                }

                if (board.EndDate == today && progress.Percent < 100)
                {
                    var result = await notifications.NotifyAsync(
                        user,
                        NotificationType.Reminder,
                        "Период карточки завершается",
                        $"Сегодня последний день карточки «{board.Title}». Выполнено {progress.Percent}% — это твой прогресс, и он уже есть.",
                        $"period-end-{board.Id}-{today:yyyyMMdd}",
                        board.Id,
                        respectQuietHours: true,
                        ct);
                    if (result is not null) created++;
                }
            }
        }

        return created;
    }
}