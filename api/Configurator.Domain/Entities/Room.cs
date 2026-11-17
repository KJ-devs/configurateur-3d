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

    /// <summary>Where the room sits on the project's overall plan, in mm. The floor polygon stays room-local.</summary>
    public double PositionX { get; set; }
    public double PositionZ { get; set; }

    /// <summary>Free label grouping rooms on the plan, e.g. a floor of the house.</summary>
    public string? GroupName { get; set; }
    public bool IsHidden { get; set; }

    public List<Opening> Openings { get; set; } = [];
    public List<FurnitureInstance> Instances { get; set; } = [];
}
