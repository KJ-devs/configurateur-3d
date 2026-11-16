namespace Configurator.Domain.Entities;

public class Material : BaseEntity
{
    public required string Name { get; set; }
    public MaterialKind Kind { get; set; }
    public required string ColorHex { get; set; }
    public string? TextureUrl { get; set; }
    public int[] Thicknesses { get; set; } = [];
    public int[] Depths { get; set; } = [];
    public decimal PricePerM2 { get; set; }
}
