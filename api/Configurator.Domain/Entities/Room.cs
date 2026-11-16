namespace Configurator.Domain.Entities;

public class Room : BaseEntity
{
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }
    public required string Name { get; set; }

    /// <summary>Floor outline in mm. Wall i joins point i to point i+1.</summary>
    public List<Point2> FloorPolygon { get; set; } = [];
    public int CeilingHeight { get; set; } = 2500;
    public int WallThickness { get; set; } = 100;
    public Guid? FloorMaterialId { get; set; }
    public Material? FloorMaterial { get; set; }
    public Guid? WallMaterialId { get; set; }
    public Material? WallMaterial { get; set; }
    public int SortOrder { get; set; }

    public List<Opening> Openings { get; set; } = [];
    public List<FurnitureInstance> Instances { get; set; } = [];
}
