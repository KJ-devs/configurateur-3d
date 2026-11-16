namespace Configurator.Domain.Entities;

public class FurnitureModel : BaseEntity
{
    public required string Name { get; set; }
    public required string Category { get; set; }
    public FurnitureType Type { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int Depth { get; set; }
    public string? AssetUrl { get; set; }

    /// <summary>ParametricFurniture JSON document (jsonb), only for parametric models.</summary>
    public string? ParametricDefinition { get; set; }
    public string? ThumbnailUrl { get; set; }
    public decimal? BasePrice { get; set; }
    public Guid? MaterialId { get; set; }
    public Material? Material { get; set; }
}
