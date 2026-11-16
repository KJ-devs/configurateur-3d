using System.Text.Json;
using Configurator.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Configurator.Infrastructure.Persistence;

public static class DbSeeder
{
    public static readonly Guid OakId = new("11111111-0000-0000-0000-000000000001");
    public static readonly Guid WalnutId = new("11111111-0000-0000-0000-000000000002");
    public static readonly Guid WhiteId = new("11111111-0000-0000-0000-000000000003");
    public static readonly Guid AnthraciteId = new("11111111-0000-0000-0000-000000000004");
    public static readonly Guid ParquetId = new("11111111-0000-0000-0000-000000000005");
    public static readonly Guid WallPaintId = new("11111111-0000-0000-0000-000000000006");

    private const int PanelThickness = 18;
    private static readonly int[] PanelDepths = [300, 400, 450, 500, 600];

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (await db.Materials.AnyAsync(ct)) return;

        db.Materials.AddRange(
            PanelMaterial(OakId, "Chêne naturel", MaterialKind.Wood, "#c8a97e", 68m),
            PanelMaterial(WalnutId, "Noyer", MaterialKind.Wood, "#6b4a32", 85m),
            PanelMaterial(WhiteId, "Laqué blanc mat", MaterialKind.Lacquer, "#f2f0eb", 54m),
            PanelMaterial(AnthraciteId, "Laqué anthracite", MaterialKind.Lacquer, "#3a3d42", 58m),
            new Material { Id = ParquetId, Name = "Parquet chêne clair", Kind = MaterialKind.Floor, ColorHex = "#d9c3a0", PricePerM2 = 45m },
            new Material { Id = WallPaintId, Name = "Peinture blanche", Kind = MaterialKind.Wall, ColorHex = "#f5f3ef", PricePerM2 = 8m });

        db.FurnitureModels.AddRange(
            Parametric("Bibliothèque 2 colonnes", "Rangement", 800, 2000, 300, OakId, 80,
                Split("root", "x", [Flex(), Flex()], Leaf("a", Shelves(4)), Leaf("b", Shelves(4)))),
            Parametric("Dressing penderie", "Chambre", 1000, 2200, 600, WhiteId, 80,
                Split("root", "x", [Flex(), Flex()],
                    Split("a", "y", [Fixed(400), Flex()], Leaf("a1", Drawers(2)), Leaf("a2", Content("rail"))),
                    Leaf("b", Shelves(4)))),
            Parametric("Buffet 3 modules", "Salle à manger", 1600, 800, 400, WalnutId, 100,
                Split("root", "x", [Flex(), Flex(), Flex()],
                    Leaf("a", Door("left")), Leaf("b", Drawers(3)), Leaf("c", Door("right")))),
            Parametric("Meuble TV", "Salon", 1800, 450, 400, AnthraciteId, 0,
                Split("root", "x", [Flex(), Flex(2), Flex()],
                    Leaf("a", Drawers(1)), Leaf("b", Shelves(1)), Leaf("c", Drawers(1)))),
            Parametric("Étagère cube 3×3", "Rangement", 1200, 1200, 300, OakId, 0,
                Split("root", "y", [Flex(), Flex(), Flex()], CubeRow("r1"), CubeRow("r2"), CubeRow("r3"))),
            Parametric("Commode 4 tiroirs", "Chambre", 900, 850, 450, WhiteId, 80,
                Leaf("root", Drawers(4))),
            Asset("Canapé 3 places", "Salon", 2200, 850, 950, 899m),
            Asset("Fauteuil", "Salon", 800, 800, 850, 349m),
            Asset("Lit double 160", "Chambre", 1600, 450, 2000, 599m),
            Asset("Table à manger", "Salle à manger", 1800, 750, 900, 449m));

        await db.SaveChangesAsync(ct);
    }

    private static Material PanelMaterial(Guid id, string name, MaterialKind kind, string color, decimal price) => new()
    {
        Id = id, Name = name, Kind = kind, ColorHex = color, PricePerM2 = price,
        Thicknesses = [PanelThickness], Depths = PanelDepths,
    };

    private static FurnitureModel Asset(string name, string category, int width, int height, int depth, decimal price) => new()
    {
        Name = name, Category = category, Type = FurnitureType.Asset,
        Width = width, Height = height, Depth = depth, BasePrice = price,
    };

    private static FurnitureModel Parametric(
        string name, string category, int width, int height, int depth, Guid materialId, int plinthHeight, object root) => new()
    {
        Name = name, Category = category, Type = FurnitureType.Parametric,
        Width = width, Height = height, Depth = depth, MaterialId = materialId,
        ParametricDefinition = JsonSerializer.Serialize(new
        {
            schemaVersion = 1, width, height, depth,
            panelThickness = PanelThickness, materialId, hasBack = true, plinthHeight, root,
        }),
    };

    private static object CubeRow(string id) => Split(id, "x", [Flex(), Flex(), Flex()],
        Leaf($"{id}a", Content("empty")), Leaf($"{id}b", Content("empty")), Leaf($"{id}c", Content("empty")));

    private static object Leaf(string id, object content) => new { id, type = "leaf", content };

    private static object Split(string id, string axis, object[] sizes, params object[] children) =>
        new { id, type = "split", axis, sizes, children };

    private static object Flex(double weight = 1) => new { mode = "flex", weight };
    private static object Fixed(int mm) => new { mode = "fixed", mm };
    private static object Content(string kind) => new { kind };
    private static object Shelves(int count) => new { kind = "shelf", count };
    private static object Drawers(int count) => new { kind = "drawer", count };
    private static object Door(string hinge) => new { kind = "door", hinge };
}
