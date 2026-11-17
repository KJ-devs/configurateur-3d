using Configurator.Api.Dtos;
using Configurator.Domain.Entities;
using Configurator.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Configurator.Api.Controllers;

[ApiController]
[Route("api")]
public class RoomsController(AppDbContext db) : ControllerBase
{
    [HttpGet("projects/{projectId:guid}/rooms")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<RoomDto>>> GetRooms(Guid projectId, CancellationToken ct)
    {
        if (!await db.Projects.AnyAsync(project => project.Id == projectId, ct)) return NotFound();

        var rooms = await WithChildren().AsNoTracking()
            .Where(room => room.ProjectId == projectId)
            .OrderBy(room => room.SortOrder).ThenBy(room => room.CreatedAt)
            .ToListAsync(ct);
        return rooms.Select(room => room.ToDto()).ToList();
    }

    [HttpGet("rooms/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<RoomDto>> GetRoom(Guid id, CancellationToken ct)
    {
        var room = await WithChildren().AsNoTracking().FirstOrDefaultAsync(room => room.Id == id, ct);
        return room is null ? NotFound() : room.ToDto();
    }

    [HttpPost("projects/{projectId:guid}/rooms")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<RoomDto>> CreateRoom(Guid projectId, RoomRequest request, CancellationToken ct)
    {
        if (!await db.Projects.AnyAsync(project => project.Id == projectId, ct)) return NotFound();

        var room = new Room { ProjectId = projectId, Name = request.Name };
        request.Apply(room);
        db.Rooms.Add(room);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetRoom), new { id = room.Id }, room.ToDto());
    }

    [HttpPut("rooms/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<RoomDto>> UpdateRoom(Guid id, RoomRequest request, CancellationToken ct)
    {
        var room = await WithChildren().FirstOrDefaultAsync(room => room.Id == id, ct);
        if (room is null) return NotFound();

        request.Apply(room);
        await db.SaveChangesAsync(ct);
        return room.ToDto();
    }

    [HttpPost("rooms/{id:guid}/duplicate")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomDto>> DuplicateRoom(Guid id, CancellationToken ct)
    {
        var source = await WithChildren().AsNoTracking().FirstOrDefaultAsync(room => room.Id == id, ct);
        if (source is null) return NotFound();

        var copy = new Room
        {
            ProjectId = source.ProjectId,
            Name = $"{source.Name} (copie)",
            FloorPolygon = source.FloorPolygon.ToList(),
            CeilingHeight = source.CeilingHeight,
            WallThickness = source.WallThickness,
            FloorMaterialId = source.FloorMaterialId,
            WallMaterialId = source.WallMaterialId,
            SortOrder = source.SortOrder + 1,
            // Next to the original on the overall plan, in the same group.
            PositionX = source.PositionX + Width(source.FloorPolygon) + DuplicateGap,
            PositionZ = source.PositionZ,
            GroupName = source.GroupName,
            Openings = source.Openings.Select(opening => new Opening
            {
                Kind = opening.Kind, WallIndex = opening.WallIndex, Offset = opening.Offset,
                Width = opening.Width, Height = opening.Height, SillHeight = opening.SillHeight, HingeSide = opening.HingeSide,
            }).ToList(),
            Instances = source.Instances.Select(instance => new FurnitureInstance
            {
                FurnitureModelId = instance.FurnitureModelId, X = instance.X, Z = instance.Z, RotationY = instance.RotationY,
                ColorOverride = instance.ColorOverride, ParametricOverride = instance.ParametricOverride,
            }).ToList(),
        };
        db.Rooms.Add(copy);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetRoom), new { id = copy.Id }, copy.ToDto());
    }

    [HttpDelete("rooms/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRoom(Guid id, CancellationToken ct)
    {
        var room = await db.Rooms.FindAsync([id], ct);
        if (room is null) return NotFound();

        db.Rooms.Remove(room);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private const double DuplicateGap = 1000;

    private static double Width(List<Point2> polygon) =>
        polygon.Count == 0 ? 0 : polygon.Max(point => point.X) - polygon.Min(point => point.X);

    private IQueryable<Room> WithChildren() => db.Rooms.AsSplitQuery()
        .Include(room => room.Openings)
        .Include(room => room.Instances);
}
