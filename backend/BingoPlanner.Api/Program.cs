using System.Text;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Endpoints;
using BingoPlanner.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ------------------------------------------------------------------ инфраструктура
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
                  ?? ["http://localhost:5173", "http://127.0.0.1:5173"];

builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

// ------------------------------------------------------------------ база данных
// Прототип по умолчанию работает на SQLite (файл bingo.db рядом с приложением).
// Для PostgreSQL достаточно выставить Database:Provider = "Postgres" и заполнить строку подключения Postgres.
var provider = builder.Configuration["Database:Provider"] ?? "Sqlite";
var connectionString = provider.Equals("Postgres", StringComparison.OrdinalIgnoreCase)
    ? builder.Configuration.GetConnectionString("Postgres") ?? "Host=localhost;Port=5432;Database=bingo;Username=bingo;Password=bingo"
    : builder.Configuration.GetConnectionString("Default") ?? "Data Source=bingo.db";

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (provider.Equals("Postgres", StringComparison.OrdinalIgnoreCase))
        options.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure());
    else
        options.UseSqlite(connectionString);
});

// ------------------------------------------------------------------ доменные сервисы
builder.Services.AddHttpClient<ITelegramSender, TelegramSender>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<GameService>();
builder.Services.AddHostedService<PeriodNotifier>();

// ------------------------------------------------------------------ аутентификация (JWT)
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "Задайте Jwt:Key длиной не менее 32 байт (appsettings.Development.json или переменная Jwt__Key).");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ------------------------------------------------------------------ API
app.MapGet("/api/health", (IConfiguration configuration) => Results.Ok(new
{
    status = "ok",
    database = provider,
    telegramConfigured = !string.IsNullOrWhiteSpace(configuration["Telegram:BotToken"]),
    time = DateTime.UtcNow
}))
.WithTags("System")
.AllowAnonymous();

app.MapAuthEndpoints();
app.MapTaskEndpoints();
app.MapBoardEndpoints();
app.MapRewardEndpoints();
app.MapNotificationEndpoints();
app.MapStatsEndpoints();

// Отдаём собранный фронтенд (frontend/dist, скопированный в wwwroot), если он есть.
var spaIndex = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "index.html");
if (File.Exists(spaIndex))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
    app.MapFallbackToFile("index.html");
}

// ------------------------------------------------------------------ схема БД + демо-данные
await DbSeeder.InitializeAsync(app.Services, app.Configuration.GetValue("Seed:DemoData", false));

app.Run();