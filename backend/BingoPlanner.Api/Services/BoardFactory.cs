using BingoPlanner.Api.Domain;

namespace BingoPlanner.Api.Services;

public enum SlotKind { Task, Free, Placeholder }

public sealed record Slot(int Position, SlotKind Kind, int? TaskIndex);

/// <summary>Схема раскладки карточки: размер, наличие "свободной" центральной ячейки и пустых заполнителей.</summary>
public sealed record LayoutPlan(int Size, int TaskCount, bool FreeCenter, int PlaceholderCount)
{
    public int Capacity => Size * Size;
}

/// <summary>
/// Автоматическое формирование карточки бинго из списка задач.
/// </summary>
public static class BoardFactory
{
    public const int MinSize = 3;
    public const int MaxSize = 5;
    public const int MaxTasks = MaxSize * MaxSize;

    /// <summary>Подбирает размер карточки: минимально подходящий квадрат 3x3..5x5.</summary>
    public static int AutoSize(int taskCount)
    {
        for (var size = MinSize; size <= MaxSize; size++)
        {
            var diff = size * size - taskCount;
            if (diff >= 0 && diff <= 2) return size;          // почти идеальное попадание
        }

        for (var size = MinSize; size <= MaxSize; size++)
        {
            if (size * size >= taskCount) return size;
        }

        return MaxSize;
    }

    public static LayoutPlan Plan(int taskCount, int? requestedSize = null)
    {
        if (taskCount < 1)
            throw new ArgumentException("Для карточки нужна хотя бы одна задача.", nameof(taskCount));
        if (taskCount > MaxTasks)
            throw new ArgumentException($"Слишком много задач: максимум {MaxTasks} для карточки {MaxSize}x{MaxSize}.", nameof(taskCount));

        var size = requestedSize ?? AutoSize(taskCount);
        if (size is < MinSize or > MaxSize)
            throw new ArgumentException($"Размер карточки должен быть от {MinSize} до {MaxSize}.", nameof(requestedSize));
        if (taskCount > size * size)
            throw new ArgumentException($"В карточку {size}x{size} помещается максимум {size * size} задач, передано {taskCount}.", nameof(taskCount));

        var capacity = size * size;
        // Классическая "свободная" ячейка: только если она ровно одна и размер нечётный.
        var freeCenter = size % 2 == 1 && capacity - taskCount == 1;
        var placeholders = capacity - taskCount - (freeCenter ? 1 : 0);
        return new LayoutPlan(size, taskCount, freeCenter, placeholders);
    }

    /// <summary>
    /// Раскладывает задачи по сетке: задачи перемешиваются, свободная ячейка всегда в центре,
    /// пустые заполнители — в конце сетки (правый нижний угол), чтобы поле выглядело аккуратно.
    /// </summary>
    public static IReadOnlyList<Slot> Arrange(LayoutPlan plan, bool shuffle = true, Random? random = null)
    {
        random ??= Random.Shared;

        var capacity = plan.Capacity;
        var center = capacity / 2;
        var slots = new List<Slot>(capacity);

        var freePosition = plan.FreeCenter ? center : -1;
        if (plan.FreeCenter)
        {
            slots.Add(new Slot(center, SlotKind.Free, null));
        }

        var placeholderFrom = capacity - plan.PlaceholderCount;
        for (var position = placeholderFrom; position < capacity; position++)
        {
            if (position == freePosition) continue;
            slots.Add(new Slot(position, SlotKind.Placeholder, null));
        }

        var taskPositions = Enumerable.Range(0, placeholderFrom)
            .Where(p => p != freePosition)
            .ToList();
        if (shuffle) Shuffle(taskPositions, random);

        for (var i = 0; i < taskPositions.Count; i++)
        {
            slots.Add(i < plan.TaskCount
                ? new Slot(taskPositions[i], SlotKind.Task, i)
                : new Slot(taskPositions[i], SlotKind.Placeholder, null));
        }

        return slots.OrderBy(s => s.Position).ToList();
    }

    /// <summary>Пересчитывает даты периода под выбранный тип.</summary>
    public static (DateOnly Start, DateOnly End) ResolvePeriod(BoardPeriod period, DateOnly? startDate)
    {
        var start = startDate ?? DateOnly.FromDateTime(DateTime.Today);
        return period switch
        {
            BoardPeriod.Day => (start, start),
            BoardPeriod.Week => (start, start.AddDays(6)),
            BoardPeriod.Month => (new DateOnly(start.Year, start.Month, 1), new DateOnly(start.Year, start.Month, 1).AddMonths(1).AddDays(-1)),
            _ => (start, start)
        };
    }

    private static void Shuffle<T>(IList<T> list, Random random)
    {
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = random.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }
}