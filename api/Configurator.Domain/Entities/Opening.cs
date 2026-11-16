namespace Configurator.Domain.Entities;

public class Opening : BaseEntity
{
    public Guid RoomId { get; set; }
    public Room? Room { get; set; }
    public OpeningKind Kind { get; set; }
    public int WallIndex { get; set; }

    /// <summary>Distance in mm from the wall start point to the near edge of the opening.</summary>
    public double Offset { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int SillHeight { get; set; }
    public HingeSide? HingeSide { get; set; }
}
