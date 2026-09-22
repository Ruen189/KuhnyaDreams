using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Data;

public static class DbSeeder
{
    /// <summary>Создаёт схему БД (для прототипа — EnsureCreated) и при необходимости наполняет демо-данными.</summary>
    public static async Task InitializeAsync(IServiceProvider services, bool seedDemoData)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder");

        await db.Database.EnsureCreatedAsync();

        if (!seedDemoData) return;
        if (await db.Users.AnyAsync()) return;

        var (hash, salt) = AuthService.HashPassword("demo1234");
        var user = new User
        {
            Email = "demo@bingo.local",
            DisplayName = "Демо-пользователь",
            PasswordHash = hash,
            PasswordSalt = salt
        };

        db.Users.Add(user);

        db.Tasks.AddRange(
            new TaskItem { UserId = user.Id, Title = "Разобрать почту", Category = "Работа", Priority = TaskPriority.High, Difficulty = TaskDifficulty.Easy, EstimatedMinutes = 20, StartTime = new TimeOnly(9, 30), EndTime = new TimeOnly(10, 0) },
            new TaskItem { UserId = user.Id, Title = "Созвон с командой", Category = "Работа", Priority = TaskPriority.High, Difficulty = TaskDifficulty.Medium, EstimatedMinutes = 45, StartTime = new TimeOnly(11, 0), EndTime = new TimeOnly(12, 0) },
            new TaskItem { UserId = user.Id, Title = "Зарядка 15 минут", Category = "Здоровье", Priority = TaskPriority.Normal, Difficulty = TaskDifficulty.Easy, EstimatedMinutes = 15 },
            new TaskItem { UserId = user.Id, Title = "Прогулка на улице", Category = "Здоровье", Priority = TaskPriority.Normal, Difficulty = TaskDifficulty.Easy, EstimatedMinutes = 30 },
            new TaskItem { UserId = user.Id, Title = "Приготовить ужин", Category = "Дом", Priority = TaskPriority.Normal, Difficulty = TaskDifficulty.Medium, EstimatedMinutes = 40 },
            new TaskItem { UserId = user.Id, Title = "Полить цветы", Category = "Дом", Priority = TaskPriority.Low, Difficulty = TaskDifficulty.Easy, EstimatedMinutes = 10 },
            new TaskItem { UserId = user.Id, Title = "Помыть посуду", Category = "Дом", Priority = TaskPriority.Low, Difficulty = TaskDifficulty.Easy, EstimatedMinutes = 15 },
            new TaskItem { UserId = user.Id, Title = "Читать 20 страниц", Category = "Развитие", Priority = TaskPriority.Normal, Difficulty = TaskDifficulty.Medium, EstimatedMinutes = 30 },
            new TaskItem { UserId = user.Id, Title = "Урок английского", Category = "Развитие", Priority = TaskPriority.Normal, Difficulty = TaskDifficulty.Hard, EstimatedMinutes = 45 },
            new TaskItem { UserId = user.Id, Title = "Пауза без телефона", Category = "Отдых", Priority = TaskPriority.Low, Difficulty = TaskDifficulty.Easy, EstimatedMinutes = 20 });

        db.Rewards.AddRange(
            new Reward { UserId = user.Id, Title = "Кофе из любимой кофейни", Description = "Взять большой и не торопиться", Emoji = "☕" },
            new Reward { UserId = user.Id, Title = "Серия любимого сериала", Description = "Один вечер без чувства вины", Emoji = "🍿" },
            new Reward { UserId = user.Id, Title = "Горячая ванна", Description = "30 минут только для себя", Emoji = "🛁" },
            new Reward { UserId = user.Id, Title = "Новая книга", Description = "Та, которую давно откладывал", Emoji = "📚" },
            new Reward { UserId = user.Id, Title = "День без планов", Description = "Полностью свободный выходной день", Emoji = "🏖️" });

        await db.SaveChangesAsync();
        logger.LogInformation("Демо-данные созданы: пользователь {Email}, пароль demo1234", user.Email);
    }
}