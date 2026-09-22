namespace BingoPlanner.Api.Services;

/// <summary>Состояние отдельной ячейки для расчёта прогресса.</summary>
public readonly record struct CellState(bool IsPlayable, bool IsCompleted);

public sealed record LineInfo(int Index, string Kind, bool IsActive, bool IsComplete, int Missing);

public sealed record ProgressResult(
    int Size,
    int PlayableCells,
    int CompletedCells,
    int Percent,
    int CompletedLines,
    int ActiveLines,
    int CellsToNextLine,
    bool HasBingo,
    bool IsFullCard,
    IReadOnlyList<LineInfo> Lines);

/// <summary>
/// Чистая игровая логика расчёта прогресса карточки бинго.
/// Вынесена отдельно, чтобы её можно было покрыть юнит-тестами без БД.
/// </summary>
public static class ProgressCalculator
{
    public static IReadOnlyList<LineInfo> BuildLines(int size)
    {
        var lines = new List<LineInfo>();
        var index = 0;

        for (var row = 0; row < size; row++)
        {
            lines.Add(new LineInfo(index++, "row", false, false, 0));
        }

        for (var col = 0; col < size; col++)
        {
            lines.Add(new LineInfo(index++, "col", false, false, 0));
        }

        lines.Add(new LineInfo(index++, "diag", false, false, 0));
        lines.Add(new LineInfo(index, "anti-diag", false, false, 0));
        return lines;
    }

    public static IReadOnlyList<int[]> BuildLineIndexes(int size)
    {
        var lines = new List<int[]>();

        for (var row = 0; row < size; row++)
        {
            lines.Add(Enumerable.Range(row * size, size).ToArray());
        }

        for (var col = 0; col < size; col++)
        {
            lines.Add(Enumerable.Range(0, size).Select(r => r * size + col).ToArray());
        }

        lines.Add(Enumerable.Range(0, size).Select(i => i * size + i).ToArray());
        lines.Add(Enumerable.Range(0, size).Select(i => i * size + (size - 1 - i)).ToArray());
        return lines;
    }

    public static ProgressResult Compute(int size, IReadOnlyList<CellState> cells)
    {
        if (size < 2) throw new ArgumentOutOfRangeException(nameof(size), "Размер карточки должен быть не меньше 2.");
        if (cells.Count != size * size)
            throw new ArgumentException($"Ожидалось {size * size} ячеек, получено {cells.Count}.", nameof(cells));

        var playable = cells.Count(c => c.IsPlayable);
        var completed = cells.Count(c => c.IsPlayable && c.IsCompleted);
        var percent = playable == 0 ? 0 : (int)Math.Round(completed * 100.0 / playable, MidpointRounding.AwayFromZero);

        var lineIndexes = BuildLineIndexes(size);
        var lines = new List<LineInfo>(lineIndexes.Count);
        var completedLines = 0;
        var activeLines = 0;
        var cellsToNextLine = int.MaxValue;

        for (var i = 0; i < lineIndexes.Count; i++)
        {
            var indexes = lineIndexes[i];
            var playableInLine = indexes.Count(ix => cells[ix].IsPlayable);
            var completedInLine = indexes.Count(ix => cells[ix].IsPlayable && cells[ix].IsCompleted);
            var isActive = playableInLine > 0;
            var missing = playableInLine - completedInLine;
            var isComplete = isActive && missing == 0;

            var kind = i < size ? "row" : i < size * 2 ? "col" : i == size * 2 ? "diag" : "anti-diag";
            lines.Add(new LineInfo(i, kind, isActive, isComplete, missing));

            if (isActive)
            {
                activeLines++;
                if (isComplete) completedLines++;
                else cellsToNextLine = Math.Min(cellsToNextLine, missing);
            }
        }

        if (cellsToNextLine == int.MaxValue) cellsToNextLine = 0;

        return new ProgressResult(
            Size: size,
            PlayableCells: playable,
            CompletedCells: completed,
            Percent: Math.Clamp(percent, 0, 100),
            CompletedLines: completedLines,
            ActiveLines: activeLines,
            CellsToNextLine: cellsToNextLine,
            HasBingo: completedLines > 0,
            IsFullCard: playable > 0 && completed == playable,
            Lines: lines);
    }
}