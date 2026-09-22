using System.Security.Claims;
using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/auth").WithTags("Auth");

        auth.MapPost("/register", async (RegisterRequest request, AppDbContext db, AuthService authService, CancellationToken ct) =>
        {
            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            if (email.Length < 5 || !email.Contains('@'))
                return Results.BadRequest(new { error = "Укажите корректный e-mail." });
            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
                return Results.BadRequest(new { error = "Пароль должен содержать минимум 6 символов." });
            if (await db.Users.AnyAsync(u => u.Email == email, ct))
                return Results.Conflict(new { error = "Пользователь с таким e-mail уже зарегистрирован." });

            var (hash, salt) = AuthService.HashPassword(request.Password);
            var user = new User
            {
                Email = email,
                DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? email.Split('@')[0] : request.DisplayName!.Trim(),
                PasswordHash = hash,
                PasswordSalt = salt
            };

            db.Users.Add(user);
            await db.SaveChangesAsync(ct);

            var (token, expiresAt) = authService.CreateToken(user);
            return Results.Ok(new AuthResponse(token, expiresAt, user.ToDto()));
        })
        .WithSummary("Регистрация пользователя")
        .AllowAnonymous();

        auth.MapPost("/login", async (LoginRequest request, AppDbContext db, AuthService authService, CancellationToken ct) =>
        {
            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
            if (user is null || !AuthService.Verify(request.Password ?? string.Empty, user.PasswordHash, user.PasswordSalt))
                return Results.Json(new { error = "Неверный e-mail или пароль." }, statusCode: StatusCodes.Status401Unauthorized);

            var (token, expiresAt) = authService.CreateToken(user);
            return Results.Ok(new AuthResponse(token, expiresAt, user.ToDto()));
        })
        .WithSummary("Вход по e-mail и паролю")
        .AllowAnonymous();

        var me = app.MapGroup("/api/users").WithTags("Users").RequireAuthorization();

        me.MapGet("/me", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == principal.GetUserId(), ct);
            return user is null ? Results.NotFound() : Results.Ok(user.ToDto());
        })
        .WithSummary("Текущий пользователь и настройки уведомлений");

        me.MapPut("/me", async (UpdateUserRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == principal.GetUserId(), ct);
            if (user is null) return Results.NotFound();

            if (request.DisplayName is not null) user.DisplayName = request.DisplayName.Trim();
            if (request.TelegramChatId is not null) user.TelegramChatId = string.IsNullOrWhiteSpace(request.TelegramChatId) ? null : request.TelegramChatId.Trim();
            if (request.InAppEnabled is not null) user.InAppEnabled = request.InAppEnabled.Value;
            if (request.TelegramEnabled is not null) user.TelegramEnabled = request.TelegramEnabled.Value;
            if (request.NotifyOnPeriodStart is not null) user.NotifyOnPeriodStart = request.NotifyOnPeriodStart.Value;
            if (request.NotifyOnProgress is not null) user.NotifyOnProgress = request.NotifyOnProgress.Value;
            if (request.NotifyOnBingo is not null) user.NotifyOnBingo = request.NotifyOnBingo.Value;
            if (request.QuietHoursStart is not null) user.QuietHoursStart = Math.Clamp(request.QuietHoursStart.Value, 0, 23);
            if (request.QuietHoursEnd is not null) user.QuietHoursEnd = Math.Clamp(request.QuietHoursEnd.Value, 0, 23);

            await db.SaveChangesAsync(ct);
            return Results.Ok(user.ToDto());
        })
        .WithSummary("Обновить профиль и настройки уведомлений");
    }
}