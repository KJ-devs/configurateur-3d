using Configurator.Api.Dtos;
using Configurator.Domain.Entities;
using Configurator.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Configurator.Api.Controllers;

[ApiController]
[Route("api/materials")]
public class MaterialsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<MaterialDto>>> GetMaterials(CancellationToken ct)
    {
        var materials = await db.Materials.AsNoTracking().OrderBy(material => material.Name).ToListAsync(ct);
        return materials.Select(material => material.ToDto()).ToList();
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<MaterialDto>> GetMaterial(Guid id, CancellationToken ct)
    {
        var material = await db.Materials.AsNoTracking().FirstOrDefaultAsync(material => material.Id == id, ct);
        return material is null ? NotFound() : material.ToDto();
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MaterialDto>> CreateMaterial(MaterialRequest request, CancellationToken ct)
    {
        var material = new Material { Name = request.Name, ColorHex = request.ColorHex };
        request.Apply(material);
        db.Materials.Add(material);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetMaterial), new { id = material.Id }, material.ToDto());
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<MaterialDto>> UpdateMaterial(Guid id, MaterialRequest request, CancellationToken ct)
    {
        var material = await db.Materials.FindAsync([id], ct);
        if (material is null) return NotFound();

        request.Apply(material);
        await db.SaveChangesAsync(ct);
        return material.ToDto();
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteMaterial(Guid id, CancellationToken ct)
    {
        var material = await db.Materials.FindAsync([id], ct);
        if (material is null) return NotFound();
        if (await db.FurnitureModels.AnyAsync(model => model.MaterialId == id, ct))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Material in use",
                detail: "This material is used by at least one furniture model.");
        }

        db.Materials.Remove(material);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
