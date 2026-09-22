using System.Security.Claims;
using BingoPlanner.Api.Contracts;
using BingoPlanner.Api.Data;
using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Endpoints;

public static class TaskEndpoints
{
    public static void MapTaskEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tasks").WithTags("Tasks").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct, bool includeArchived = false, string? category = null, string? search = null) =>
        {
            var userId = principal.GetUserId();
            var query = db.Tasks.Where(t => t.UserId == userId);
            if (!includeArchived) query = query.Where(t => !t.IsArchived);
            if (!string.IsNullOrWhiteSpace(category)) query = query.Where(t => t.Category == category);
            if (!string.IsNullOrWhiteSpace(search)) query = query.Where(t => t.Title.ToLower().Contains(search.ToLower()));

            var tasks = await query
                .OrderByDescending(t => t.Priority)
                .ThenBy(t => t.CreatedAt)
                .ToListAsync(ct);

            return Results.Ok(tasks.Select(t => t.ToDto()).ToList());
        })
        .WithSummary("Список задач пользователя");

        group.MapGet("/categories", async (ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            var categories = await db.Tasks
                .Where(t => t.UserId == userId && !t.IsArchived)
                .Select(t => t.Category)
                .Distinct()
                .ToListAsync(ct);
            return Results.Ok(categories.OrderBy(c => c).ToList());
        })
        .WithSummary("Используемые категории задач");

        group.MapPost("/", async (UpsertTaskRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Title))
                return Results.BadRequest(new { error = "Название задачи обязательно." });

            var task = new TaskItem { UserId = principal.GetUserId(), Title = request.Title.Trim() };
            Apply(task, request);
            db.Tasks.Add(task);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/tasks/{task.Id}", task.ToDto());
        })
        .WithSummary("Создать задачу");

        group.MapPut("/{id:guid}", async (Guid id, UpsertTaskRequest request, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == principal.GetUserId(), ct);
            if (task is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(request.Title))
                return Results.BadRequest(new { error = "Название задачи обязательно." });

            task.Title = request.Title.Trim();
            Apply(task, request);
            await db.SaveChangesAsync(ct);
            return Results.Ok(task.ToDto());
        })
        .WithSummary("Обновить задачу");

        group.MapPatch("/{id:guid}/archive", async (Guid id, bool archived, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == principal.GetUserId(), ct);
            if (task is null) return Results.NotFound();
            task.IsArchived = archived;
            await db.SaveChangesAsync(ct);
            return Results.Ok(task.ToDto());
        })
        .WithSummary("Архивировать/вернуть задачу");

        group.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == principal.GetUserId(), ct);
            if (task is null) return Results.NotFound();
            db.Tasks.Remove(task);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        })
        .WithSummary("Удалить задачу");

        group.MapPost("/bulk", async (List<UpsertTaskRequest> requests, ClaimsPrincipal principal, AppDbContext db, CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            var created = new List<TaskItem>();
            foreach (var request in requests.Where(r => !string.IsNullOrWhiteSpace(r.Title)))
            {
                var task = new TaskItem { UserId = userId, Title = request.Title.Trim() };
                Apply(task, request);
                created.Add(task);
            }

            db.Tasks.AddRange(created);
            await db.SaveChangesAsync(ct);
            return Results.Ok(created.Select(t => t.ToDto()).ToList());
        })
        .WithSummary("Быстрое добавление нескольких задач (например, из текстового списка)");
    }

    private static void Apply(TaskItem task, UpsertTaskRequest request)
    {
        task.Notes = request.Notes;
        task.Category = string.IsNullOrWhiteSpace(request.Category) ? "Общее" : request.Category!.Trim();
        task.Priority = request.Priority ?? task.Priority;
        task.Difficulty = request.Difficulty ?? task.Difficulty;
        task.EstimatedMinutes = request.EstimatedMinutes is > 0 and <= 24 * 60 ? request.EstimatedMinutes.Value : task.EstimatedMinutes;
        task.ScheduledDate = request.ScheduledDate;
        task.StartTime = request.StartTime;
        task.EndTime = request.EndTime;
        if (request.IsArchived is not null) task.IsArchived = request.IsArchived.Value;
    }
}