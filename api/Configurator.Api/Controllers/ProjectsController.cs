using System.Security.Cryptography;
using Configurator.Api.Dtos;
using Configurator.Domain.Entities;
using Configurator.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Configurator.Api.Controllers;

[ApiController]
[Route("api")]
public class ProjectsController(AppDbContext db) : ControllerBase
{
    private const string ShareCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int ShareCodeLength = 8;

    [HttpGet("projects")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<ProjectDto>>> GetProjects(CancellationToken ct)
    {
        var projects = await db.Projects.AsNoTracking().OrderByDescending(project => project.UpdatedAt).ToListAsync(ct);
        return projects.Select(project => project.ToDto()).ToList();
    }

    [HttpGet("projects/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<ProjectDetailDto>> GetProject(Guid id, CancellationToken ct)
    {
        var project = await WithRooms().FirstOrDefaultAsync(project => project.Id == id, ct);
        return project is null ? NotFound() : project.ToDetailDto();
    }

    [HttpGet("share/{code}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<ProjectDetailDto>> GetSharedProject(string code, CancellationToken ct)
    {
        var shareCode = code.ToUpperInvariant();
        var project = await WithRooms().FirstOrDefaultAsync(project => project.ShareCode == shareCode, ct);
        return project is null ? NotFound() : project.ToDetailDto();
    }

    [HttpPost("projects")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProjectDto>> CreateProject(ProjectRequest request, CancellationToken ct)
    {
        var project = new Project
        {
            Name = request.Name,
            ShareCode = RandomNumberGenerator.GetString(ShareCodeAlphabet, ShareCodeLength),
        };
        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetProject), new { id = project.Id }, project.ToDto());
    }

    [HttpPut("projects/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<ProjectDto>> UpdateProject(Guid id, ProjectRequest request, CancellationToken ct)
    {
        var project = await db.Projects.FindAsync([id], ct);
        if (project is null) return NotFound();

        project.Name = request.Name;
        await db.SaveChangesAsync(ct);
        return project.ToDto();
    }

    [HttpDelete("projects/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProject(Guid id, CancellationToken ct)
    {
        var project = await db.Projects.FindAsync([id], ct);
        if (project is null) return NotFound();

        db.Projects.Remove(project);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private IQueryable<Project> WithRooms() => db.Projects.AsNoTracking().AsSplitQuery()
        .Include(project => project.Rooms).ThenInclude(room => room.Openings)
        .Include(project => project.Rooms).ThenInclude(room => room.Instances);
}
