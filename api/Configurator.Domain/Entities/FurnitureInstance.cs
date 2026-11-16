namespace Configurator.Domain.Entities;

public class FurnitureInstance : BaseEntity
{
    public Guid RoomId { get; set; }
    public Room? Room { get; set; }
    public Guid FurnitureModelId { get; set; }
    public FurnitureModel? FurnitureModel { get; set; }
    public double X { get; set; }
    public double Z { get; set; }
    public double RotationY { get; set; }
    public string? ColorOverride { get; set; }

    /// <summary>Full ParametricFurniture JSON copy (jsonb) when the instance was customised.</summary>
    public string? ParametricOverride { get; set; }
}
