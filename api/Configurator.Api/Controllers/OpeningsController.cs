using Configurator.Api.Dtos;
using Configurator.Domain.Entities;
using Configurator.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Configurator.Api.Controllers;

[ApiController]
[Route("api")]
public class OpeningsController(AppDbContext db) : ControllerBase
{
    [HttpGet("rooms/{roomId:guid}/openings")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<OpeningDto>>> GetOpenings(Guid roomId, CancellationToken ct)
    {
        if (!await db.Rooms.AnyAsync(room => room.Id == roomId, ct)) return NotFound();

        var openings = await db.Openings.AsNoTracking()
            .Where(opening => opening.RoomId == roomId)
            .OrderBy(opening => opening.CreatedAt)
            .ToListAsync(ct);
        return openings.Select(opening => opening.ToDto()).ToList();
    }

    [HttpPost("rooms/{roomId:guid}/openings")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OpeningDto>> CreateOpening(Guid roomId, OpeningRequest request, CancellationToken ct)
    {
        var room = await db.Rooms.AsNoTracking().FirstOrDefaultAsync(room => room.Id == roomId, ct);
        if (room is null) return NotFound();
        if (!IsOnExistingWall(request, room)) return WallIndexProblem();

        var opening = new Opening { RoomId = roomId };
        request.Apply(opening);
        db.Openings.Add(opening);
        await db.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, opening.ToDto());
    }

    [HttpPut("openings/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<OpeningDto>> UpdateOpening(Guid id, OpeningRequest request, CancellationToken ct)
    {
        var opening = await db.Openings.Include(opening => opening.Room).FirstOrDefaultAsync(opening => opening.Id == id, ct);
        if (opening is null) return NotFound();
        if (!IsOnExistingWall(request, opening.Room!)) return WallIndexProblem();

        request.Apply(opening);
        await db.SaveChangesAsync(ct);
        return opening.ToDto();
    }

    [HttpDelete("openings/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteOpening(Guid id, CancellationToken ct)
    {
        var opening = await db.Openings.FindAsync([id], ct);
        if (opening is null) return NotFound();

        db.Openings.Remove(opening);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static bool IsOnExistingWall(OpeningRequest request, Room room) => request.WallIndex < room.FloorPolygon.Count;

    private ActionResult WallIndexProblem()
    {
        ModelState.AddModelError(nameof(OpeningRequest.WallIndex), "The wall index does not exist in this room.");
        return ValidationProblem(ModelState);
    }
}
