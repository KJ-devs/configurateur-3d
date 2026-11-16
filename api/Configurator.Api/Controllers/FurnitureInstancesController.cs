using Configurator.Api.Dtos;
using Configurator.Domain.Entities;
using Configurator.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Configurator.Api.Controllers;

[ApiController]
[Route("api")]
public class FurnitureInstancesController(AppDbContext db) : ControllerBase
{
    [HttpGet("rooms/{roomId:guid}/instances")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<FurnitureInstanceDto>>> GetInstances(Guid roomId, CancellationToken ct)
    {
        if (!await db.Rooms.AnyAsync(room => room.Id == roomId, ct)) return NotFound();

        var instances = await db.FurnitureInstances.AsNoTracking()
            .Where(instance => instance.RoomId == roomId)
            .OrderBy(instance => instance.CreatedAt)
            .ToListAsync(ct);
        return instances.Select(instance => instance.ToDto()).ToList();
    }

    [HttpPost("rooms/{roomId:guid}/instances")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<FurnitureInstanceDto>> CreateInstance(Guid roomId, FurnitureInstanceRequest request, CancellationToken ct)
    {
        if (!await db.Rooms.AnyAsync(room => room.Id == roomId, ct)) return NotFound();
        if (!await ModelsExist([request.FurnitureModelId], ct)) return UnknownModelProblem();

        var instance = new FurnitureInstance { RoomId = roomId };
        request.Apply(instance);
        db.FurnitureInstances.Add(instance);
        await db.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, instance.ToDto());
    }

    /// <summary>Replaces all instances of the room in one call (used by the autosave).</summary>
    [HttpPut("rooms/{roomId:guid}/instances")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<FurnitureInstanceDto>>> SyncInstances(Guid roomId, SyncInstancesRequest request, CancellationToken ct)
    {
        if (!await db.Rooms.AnyAsync(room => room.Id == roomId, ct)) return NotFound();
        if (!await ModelsExist(request.Instances.Select(upsert => upsert.FurnitureModelId), ct)) return UnknownModelProblem();

        var existing = await db.FurnitureInstances.Where(instance => instance.RoomId == roomId).ToDictionaryAsync(instance => instance.Id, ct);
        var keptIds = new HashSet<Guid>();
        foreach (var upsert in request.Instances)
        {
            var id = upsert.Id ?? Guid.NewGuid();
            if (!existing.TryGetValue(id, out var instance))
            {
                instance = new FurnitureInstance { Id = id, RoomId = roomId };
                db.FurnitureInstances.Add(instance);
            }
            upsert.ToRequest().Apply(instance);
            keptIds.Add(id);
        }
        db.FurnitureInstances.RemoveRange(existing.Values.Where(instance => !keptIds.Contains(instance.Id)));
        await db.SaveChangesAsync(ct);

        return await GetInstances(roomId, ct);
    }

    [HttpPut("instances/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<FurnitureInstanceDto>> UpdateInstance(Guid id, FurnitureInstanceRequest request, CancellationToken ct)
    {
        var instance = await db.FurnitureInstances.FindAsync([id], ct);
        if (instance is null) return NotFound();
        if (!await ModelsExist([request.FurnitureModelId], ct)) return UnknownModelProblem();

        request.Apply(instance);
        await db.SaveChangesAsync(ct);
        return instance.ToDto();
    }

    [HttpDelete("instances/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteInstance(Guid id, CancellationToken ct)
    {
        var instance = await db.FurnitureInstances.FindAsync([id], ct);
        if (instance is null) return NotFound();

        db.FurnitureInstances.Remove(instance);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<bool> ModelsExist(IEnumerable<Guid> modelIds, CancellationToken ct)
    {
        var distinctIds = modelIds.Distinct().ToList();
        var found = await db.FurnitureModels.CountAsync(model => distinctIds.Contains(model.Id), ct);
        return found == distinctIds.Count;
    }

    private ActionResult UnknownModelProblem()
    {
        ModelState.AddModelError(nameof(FurnitureInstanceRequest.FurnitureModelId), "Unknown furniture model.");
        return ValidationProblem(ModelState);
    }
}
