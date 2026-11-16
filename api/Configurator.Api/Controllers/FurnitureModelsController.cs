using Configurator.Api.Dtos;
using Configurator.Domain.Entities;
using Configurator.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Configurator.Api.Controllers;

[ApiController]
[Route("api/furniture-models")]
public class FurnitureModelsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<FurnitureModelDto>>> GetFurnitureModels(
        [FromQuery] string? search, [FromQuery] string? category, CancellationToken ct)
    {
        var query = db.FurnitureModels.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(model => EF.Functions.ILike(model.Name, $"%{search.Trim()}%"));
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(model => model.Category == category);

        var models = await query.OrderBy(model => model.Category).ThenBy(model => model.Name).ToListAsync(ct);
        return models.Select(model => model.ToDto()).ToList();
    }

    [HttpGet("categories")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<string>>> GetFurnitureCategories(CancellationToken ct) =>
        await db.FurnitureModels.Select(model => model.Category).Distinct().OrderBy(category => category).ToListAsync(ct);

    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<FurnitureModelDto>> GetFurnitureModel(Guid id, CancellationToken ct)
    {
        var model = await db.FurnitureModels.AsNoTracking().FirstOrDefaultAsync(model => model.Id == id, ct);
        return model is null ? NotFound() : model.ToDto();
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<FurnitureModelDto>> CreateFurnitureModel(FurnitureModelRequest request, CancellationToken ct)
    {
        if (!await MaterialExists(request.MaterialId, ct)) return UnknownMaterialProblem();

        var model = new FurnitureModel { Name = request.Name, Category = request.Category };
        request.Apply(model);
        db.FurnitureModels.Add(model);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetFurnitureModel), new { id = model.Id }, model.ToDto());
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<FurnitureModelDto>> UpdateFurnitureModel(Guid id, FurnitureModelRequest request, CancellationToken ct)
    {
        var model = await db.FurnitureModels.FindAsync([id], ct);
        if (model is null) return NotFound();
        if (!await MaterialExists(request.MaterialId, ct)) return UnknownMaterialProblem();

        request.Apply(model);
        await db.SaveChangesAsync(ct);
        return model.ToDto();
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteFurnitureModel(Guid id, CancellationToken ct)
    {
        var model = await db.FurnitureModels.FindAsync([id], ct);
        if (model is null) return NotFound();
        if (await db.FurnitureInstances.AnyAsync(instance => instance.FurnitureModelId == id, ct))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Furniture model in use",
                detail: "This model is placed in at least one room.");
        }

        db.FurnitureModels.Remove(model);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<bool> MaterialExists(Guid? materialId, CancellationToken ct) =>
        materialId is null || await db.Materials.AnyAsync(material => material.Id == materialId, ct);

    private ActionResult UnknownMaterialProblem()
    {
        ModelState.AddModelError(nameof(FurnitureModelRequest.MaterialId), "Unknown material.");
        return ValidationProblem(ModelState);
    }
}
