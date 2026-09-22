using BingoPlanner.Api.Domain;
using BingoPlanner.Api.Services;

namespace BingoPlanner.Tests;

/// <summary>Проверки автоматического подбора размера карточки и раскладки задач по сетке.</summary>
public class BoardFactoryTests
{
    [Theory]
    [InlineData(1, 3)]
    [InlineData(7, 3)]
    [InlineData(8, 3)]
    [InlineData(9, 3)]
    [InlineData(10, 4)]
    [InlineData(15, 4)]
    [InlineData(16, 4)]
    [InlineData(17, 5)]
    [InlineData(25, 5)]
    public void AutoSize_PicksMinimalFittingSquare(int taskCount, int expected)
    {
        Assert.Equal(expected, BoardFactory.AutoSize(taskCount));
    }

    [Fact]
    public void Plan_UsesFreeCenterWhenOneCellRemains()
    {
        // 8 задач в карточку 3x3: одна клетка остаётся — она становится «свободной».
        var plan = BoardFactory.Plan(8);

        Assert.Equal(3, plan.Size);
        Assert.True(plan.FreeCenter);
        Assert.Equal(0, plan.PlaceholderCount);
    }

    [Fact]
    public void Plan_AddsPlaceholdersWhenGapIsBiggerThanOne()
    {
        // 7 задач в карточку 3x3: 2 пустых заполнителя, свободной клетки нет.
        var plan = BoardFactory.Plan(7);

        Assert.Equal(3, plan.Size);
        Assert.False(plan.FreeCenter);
        Assert.Equal(2, plan.PlaceholderCount);
    }

    [Fact]
    public void Plan_RespectsRequestedSize()
    {
        var plan = BoardFactory.Plan(4, requestedSize: 3);

        Assert.Equal(3, plan.Size);
        Assert.Equal(5, plan.PlaceholderCount);
        Assert.False(plan.FreeCenter);
    }

    [Fact]
    public void Plan_RejectsEmptyAndOversizedTaskLists()
    {
        Assert.Throws<ArgumentException>(() => BoardFactory.Plan(0));
        Assert.Throws<ArgumentException>(() => BoardFactory.Plan(26));
    }

    [Fact]
    public void Plan_RejectsTooSmallRequestedSize()
    {
        Assert.Throws<ArgumentException>(() => BoardFactory.Plan(5, requestedSize: 2));
        Assert.Throws<ArgumentException>(() => BoardFactory.Plan(12, requestedSize: 3));
    }

    [Fact]
    public void Arrange_CoversEveryCellExactlyOnce()
    {
        var plan = BoardFactory.Plan(7);
        var slots = BoardFactory.Arrange(plan, shuffle: false);

        Assert.Equal(9, slots.Count);
        Assert.Equal(Enumerable.Range(0, 9), slots.Select(s => s.Position));
        Assert.Equal(7, slots.Count(s => s.Kind == SlotKind.Task));
        Assert.Equal(2, slots.Count(s => s.Kind == SlotKind.Placeholder));
        Assert.Equal(Enumerable.Range(0, 7), slots.Where(s => s.Kind == SlotKind.Task).Select(s => s.TaskIndex!.Value));
    }

    [Fact]
    public void Arrange_PutsFreeCellInTheCenter()
    {
        var plan = BoardFactory.Plan(8);
        var slots = BoardFactory.Arrange(plan, shuffle: false);

        var free = Assert.Single(slots, s => s.Kind == SlotKind.Free);
        Assert.Equal(4, free.Position);                       // центр сетки 3x3
        Assert.Null(free.TaskIndex);
    }

    [Fact]
    public void Arrange_IsDeterministicWithoutShuffle()
    {
        var plan = BoardFactory.Plan(9);

        var first = BoardFactory.Arrange(plan, shuffle: false);
        var second = BoardFactory.Arrange(plan, shuffle: false);

        Assert.Equal(
            first.Select(s => (s.Position, s.Kind, s.TaskIndex)),
            second.Select(s => (s.Position, s.Kind, s.TaskIndex)));
    }

    [Fact]
    public void Arrange_ShufflesTaskPositionsWithFixedRandom()
    {
        var plan = BoardFactory.Plan(9);

        var straight = BoardFactory.Arrange(plan, shuffle: false, random: new Random(1));
        var shuffled = BoardFactory.Arrange(plan, shuffle: true, random: new Random(1));

        Assert.Equal(
            straight.Select(s => (s.Position, s.Kind)).OrderBy(x => x.Position),
            shuffled.Select(s => (s.Position, s.Kind)).OrderBy(x => x.Position));
        Assert.NotEqual(
            straight.OrderBy(s => s.Position).Select(s => s.TaskIndex).ToList(),
            shuffled.OrderBy(s => s.Position).Select(s => s.TaskIndex).ToList());
    }

    [Theory]
    [InlineData(BoardPeriod.Day, 0)]
    [InlineData(BoardPeriod.Week, 6)]
    public void ResolvePeriod_ComputesRangeFromStartDate(BoardPeriod period, int days)
    {
        var start = new DateOnly(2026, 3, 10);
        var (from, to) = BoardFactory.ResolvePeriod(period, start);

        Assert.Equal(start, from);
        Assert.Equal(start.AddDays(days), to);
    }

    [Fact]
    public void ResolvePeriod_MonthSnapsToCalendarBounds()
    {
        var (from, to) = BoardFactory.ResolvePeriod(BoardPeriod.Month, new DateOnly(2026, 2, 14));

        Assert.Equal(new DateOnly(2026, 2, 1), from);
        Assert.Equal(new DateOnly(2026, 2, 28), to);
    }
}