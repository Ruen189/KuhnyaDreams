using BingoPlanner.Api.Services;

namespace BingoPlanner.Tests;

/// <summary>Проверки чистой игровой логики: линии, свободная ячейка, заполнители.</summary>
public class ProgressCalculatorTests
{
    private static CellState[] Empty(int size) =>
        Enumerable.Range(0, size * size).Select(_ => new CellState(true, false)).ToArray();

    private static CellState[] With(int size, params int[] completedIndexes)
    {
        var cells = Empty(size);
        foreach (var index in completedIndexes) cells[index] = new CellState(true, true);
        return cells;
    }

    [Fact]
    public void Compute_BuildsRowsColumnsAndDiagonals()
    {
        var progress = ProgressCalculator.Compute(3, Empty(3));
        Assert.Equal(8, progress.Lines.Count);
        Assert.Equal(3, progress.Lines.Count(l => l.Kind == "row"));
        Assert.Equal(3, progress.Lines.Count(l => l.Kind == "col"));
        Assert.Single(progress.Lines, l => l.Kind == "diag");
        Assert.Single(progress.Lines, l => l.Kind == "anti-diag");
    }

    [Fact]
    public void Compute_DetectsCompletedRowAsBingo()
    {
        var progress = ProgressCalculator.Compute(3, With(3, 0, 1, 2));

        Assert.Equal(1, progress.CompletedLines);
        Assert.True(progress.HasBingo);
        Assert.False(progress.IsFullCard);
        Assert.Equal(33, progress.Percent);
        Assert.Equal(3, progress.CompletedCells);
    }

    [Fact]
    public void Compute_DetectsCompletedDiagonal()
    {
        var progress = ProgressCalculator.Compute(3, With(3, 0, 4, 8));
        Assert.Equal(1, progress.CompletedLines);
        Assert.True(progress.HasBingo);
        Assert.Contains(progress.Lines, l => l.Kind == "diag" && l.IsComplete);
    }

    [Fact]
    public void Compute_ReportsCellsToNextLine()
    {
        var progress = ProgressCalculator.Compute(3, With(3, 0, 1));

        Assert.False(progress.HasBingo);
        Assert.Equal(1, progress.CellsToNextLine);
        Assert.Equal(2, progress.CompletedLines == 0 ? progress.CompletedCells : 0);
    }

    [Fact]
    public void Compute_FullCardIsBingo()
    {
        var progress = ProgressCalculator.Compute(3, With(3, 0, 1, 2, 3, 4, 5, 6, 7, 8));

        Assert.True(progress.HasBingo);
        Assert.True(progress.IsFullCard);
        Assert.Equal(100, progress.Percent);
        Assert.Equal(8, progress.CompletedLines);
    }

    [Fact]
    public void Compute_PlaceholdersDoNotBreakLinesAndAreNotPlayable()
    {
        // 3x3, клетка 4 (центр) — заполнитель: строка, столбец и диагонали остаются полными без неё.
        var cells = With(3, 0, 2, 3, 5, 6, 8);
        cells[4] = new CellState(IsPlayable: false, IsCompleted: false);
        cells[7] = new CellState(IsPlayable: false, IsCompleted: false);

        var progress = ProgressCalculator.Compute(3, cells);

        Assert.Equal(7, progress.PlayableCells);          // заполнители исключены из знаменателя
        Assert.Equal(6, progress.CompletedCells);
        Assert.True(progress.HasBingo);                   // диагональ 0-4-8 и 2-4-6 закрыты
        Assert.False(progress.IsFullCard);
        Assert.Equal(86, progress.Percent);
    }

    [Fact]
    public void Compute_FreeCellCountsAsCompleted()
    {
        // Свободная ячейка: играбельная и сразу выполненная (передаётся как IsCompleted = true).
        var progress = ProgressCalculator.Compute(3, With(3, 4));

        Assert.Equal(1, progress.CompletedCells);
        Assert.Equal(11, progress.Percent);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(0)]
    public void Compute_RejectsTooSmallSize(int size)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => ProgressCalculator.Compute(size, Empty(2)));
    }

    [Fact]
    public void Compute_RejectsCellCountMismatch()
    {
        Assert.Throws<ArgumentException>(() => ProgressCalculator.Compute(3, Empty(2)));
    }
}