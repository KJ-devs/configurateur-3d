namespace Configurator.Domain.Entities;

public class Project : BaseEntity
{
    public required string Name { get; set; }
    public required string ShareCode { get; set; }
    public List<Room> Rooms { get; set; } = [];
}
