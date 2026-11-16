using System.Text.Json;
using Configurator.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Configurator.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Opening> Openings => Set<Opening>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<FurnitureModel> FurnitureModels => Set<FurnitureModel>();
    public DbSet<FurnitureInstance> FurnitureInstances => Set<FurnitureInstance>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Project>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(200);
            e.Property(p => p.ShareCode).HasMaxLength(16);
            e.HasIndex(p => p.ShareCode).IsUnique();
            e.HasMany(p => p.Rooms).WithOne(r => r.Project).HasForeignKey(r => r.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Room>(e =>
        {
            e.Property(r => r.Name).HasMaxLength(200);
            e.Property(r => r.FloorPolygon)
                .HasColumnType("jsonb")
                .HasConversion(
                    points => JsonSerializer.Serialize(points, JsonOptions),
                    json => JsonSerializer.Deserialize<List<Point2>>(json, JsonOptions) ?? new List<Point2>(),
                    new ValueComparer<List<Point2>>(
                        (a, b) => a!.SequenceEqual(b!),
                        points => points.Aggregate(0, (hash, point) => HashCode.Combine(hash, point.GetHashCode())),
                        points => points.ToList()));
            e.HasOne(r => r.FloorMaterial).WithMany().HasForeignKey(r => r.FloorMaterialId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(r => r.WallMaterial).WithMany().HasForeignKey(r => r.WallMaterialId).OnDelete(DeleteBehavior.SetNull);
            e.HasMany(r => r.Openings).WithOne(o => o.Room).HasForeignKey(o => o.RoomId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(r => r.Instances).WithOne(i => i.Room).HasForeignKey(i => i.RoomId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Opening>(e =>
        {
            e.Property(o => o.Kind).HasConversion<string>().HasMaxLength(16);
            e.Property(o => o.HingeSide).HasConversion<string>().HasMaxLength(16);
        });

        modelBuilder.Entity<Material>(e =>
        {
            e.Property(m => m.Name).HasMaxLength(200);
            e.Property(m => m.Kind).HasConversion<string>().HasMaxLength(16);
            e.Property(m => m.ColorHex).HasMaxLength(9);
            e.Property(m => m.PricePerM2).HasPrecision(10, 2);
        });

        modelBuilder.Entity<FurnitureModel>(e =>
        {
            e.Property(f => f.Name).HasMaxLength(200);
            e.Property(f => f.Category).HasMaxLength(100);
            e.HasIndex(f => f.Category);
            e.Property(f => f.Type).HasConversion<string>().HasMaxLength(16);
            e.Property(f => f.ParametricDefinition).HasColumnType("jsonb");
            e.Property(f => f.BasePrice).HasPrecision(10, 2);
            e.HasOne(f => f.Material).WithMany().HasForeignKey(f => f.MaterialId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<FurnitureInstance>(e =>
        {
            e.Property(i => i.ColorOverride).HasMaxLength(9);
            e.Property(i => i.ParametricOverride).HasColumnType("jsonb");
            e.HasOne(i => i.FurnitureModel).WithMany().HasForeignKey(i => i.FurnitureModelId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified) entry.Entity.UpdatedAt = now;
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
