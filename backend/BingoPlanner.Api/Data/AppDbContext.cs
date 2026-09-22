using BingoPlanner.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace BingoPlanner.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<Board> Boards => Set<Board>();
    public DbSet<BoardCell> BoardCells => Set<BoardCell>();
    public DbSet<Reward> Rewards => Set<Reward>();
    public DbSet<Achievement> Achievements => Set<Achievement>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).HasMaxLength(256).IsRequired();
            e.Property(u => u.DisplayName).HasMaxLength(128);
            e.HasMany(u => u.Tasks).WithOne(t => t.User!).HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(u => u.Boards).WithOne(b => b.User!).HasForeignKey(b => b.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(u => u.Rewards).WithOne(r => r.User!).HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TaskItem>(e =>
        {
            e.Property(t => t.Title).HasMaxLength(256).IsRequired();
            e.Property(t => t.Category).HasMaxLength(64);
            e.HasIndex(t => new { t.UserId, t.IsArchived });
        });

        modelBuilder.Entity<Board>(e =>
        {
            e.Property(b => b.Title).HasMaxLength(256).IsRequired();
            e.HasIndex(b => new { b.UserId, b.Period, b.StartDate });
            e.HasMany(b => b.Cells).WithOne(c => c.Board!).HasForeignKey(c => c.BoardId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BoardCell>(e =>
        {
            e.Property(c => c.Title).HasMaxLength(256).IsRequired();
            e.HasIndex(c => new { c.BoardId, c.Position }).IsUnique();
            e.HasOne(c => c.TaskItem).WithMany().HasForeignKey(c => c.TaskItemId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Reward>(e =>
        {
            e.Property(r => r.Title).HasMaxLength(256).IsRequired();
            e.HasIndex(r => new { r.UserId, r.IsArchived });
        });

        modelBuilder.Entity<Achievement>(e =>
        {
            e.Property(a => a.Title).HasMaxLength(256).IsRequired();
            e.HasIndex(a => new { a.BoardId, a.Kind, a.Metric }).IsUnique();
            e.HasOne(a => a.Board).WithMany().HasForeignKey(a => a.BoardId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Reward).WithMany().HasForeignKey(a => a.RewardId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Notification>(e =>
        {
            e.Property(n => n.Title).HasMaxLength(256).IsRequired();
            e.Property(n => n.DedupeKey).HasMaxLength(256).IsRequired();
            e.HasIndex(n => new { n.UserId, n.DedupeKey }).IsUnique();
            e.HasIndex(n => new { n.UserId, n.CreatedAt });
        });
    }
}