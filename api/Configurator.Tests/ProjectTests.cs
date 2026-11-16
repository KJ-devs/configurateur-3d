using System.Net;
using Configurator.Api.Dtos;
using Configurator.Domain.Entities;

namespace Configurator.Tests;

[Collection(ApiCollection.Name)]
public class ProjectTests(ApiFixture fixture)
{
    private readonly HttpClient _client = fixture.CreateClient();

    private async Task<Guid> AnyModelIdAsync() =>
        (await _client.GetAsync<List<FurnitureModelDto>>("/api/furniture-models"))[0].Id;

    [Fact]
    public async Task Project_crud_and_share_code_lookup()
    {
        var created = await _client.CreateProjectAsync("Maison");
        var renamed = await (await _client.PutAsync($"/api/projects/{created.Id}", new ProjectRequest("Maison de campagne"))).ReadAsync<ProjectDto>();
        var shared = await _client.GetAsync<ProjectDetailDto>($"/api/share/{created.ShareCode.ToLowerInvariant()}");
        var list = await _client.GetAsync<List<ProjectDto>>("/api/projects");

        Assert.Equal(8, created.ShareCode.Length);
        Assert.Equal("Maison de campagne", renamed.Name);
        Assert.Equal(created.Id, shared.Id);
        Assert.Contains(list, project => project.Id == created.Id);

        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/projects/{created.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/projects/{created.Id}")).StatusCode);
    }

    [Fact]
    public async Task Unknown_project_returns_problem_details()
    {
        var response = await _client.GetAsync($"/api/projects/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Project_name_is_required()
    {
        var response = await _client.PostAsync("/api/projects", new ProjectRequest(""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Room_is_created_updated_and_listed_in_project_detail()
    {
        var project = await _client.CreateProjectAsync();
        var room = await _client.CreateRoomAsync(project.Id, "Chambre");

        var updateRequest = new RoomRequest("Chambre parentale", HttpClientExtensions.Rectangle, 2700, 120, null, null, 1);
        var updated = await (await _client.PutAsync($"/api/rooms/{room.Id}", updateRequest)).ReadAsync<RoomDto>();
        var detail = await _client.GetAsync<ProjectDetailDto>($"/api/projects/{project.Id}");

        Assert.Equal(4, room.FloorPolygon.Count);
        Assert.Equal(new PointDto(4000, 3000), room.FloorPolygon[2]);
        Assert.Equal(2700, updated.CeilingHeight);
        Assert.Equal("Chambre parentale", Assert.Single(detail.Rooms).Name);
    }

    [Fact]
    public async Task Room_needs_at_least_three_points()
    {
        var project = await _client.CreateProjectAsync();
        var request = new RoomRequest("Couloir", [new(0, 0), new(1000, 0)], 2500, 100, null, null, 0);

        var response = await _client.PostAsync($"/api/projects/{project.Id}/rooms", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Opening_crud_and_wall_index_validation()
    {
        var project = await _client.CreateProjectAsync();
        var room = await _client.CreateRoomAsync(project.Id);
        var door = new OpeningRequest(OpeningKind.Door, 1, 500, 830, 2040, 0, HingeSide.Left);

        var created = await (await _client.PostAsync($"/api/rooms/{room.Id}/openings", door)).ReadAsync<OpeningDto>();
        var moved = await (await _client.PutAsync($"/api/openings/{created.Id}", door with { Offset = 900 })).ReadAsync<OpeningDto>();
        var invalid = await _client.PostAsync($"/api/rooms/{room.Id}/openings", door with { WallIndex = 4 });
        var listed = await _client.GetAsync<List<OpeningDto>>($"/api/rooms/{room.Id}/openings");

        Assert.Equal(HingeSide.Left, created.HingeSide);
        Assert.Equal(900, moved.Offset);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Single(listed);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/openings/{created.Id}")).StatusCode);
    }

    [Fact]
    public async Task Instance_crud_and_unknown_model_validation()
    {
        var project = await _client.CreateProjectAsync();
        var room = await _client.CreateRoomAsync(project.Id);
        var request = new FurnitureInstanceRequest(await AnyModelIdAsync(), 1000, 1500, 90, "#aabbcc", null);

        var created = await (await _client.PostAsync($"/api/rooms/{room.Id}/instances", request)).ReadAsync<FurnitureInstanceDto>();
        var moved = await (await _client.PutAsync($"/api/instances/{created.Id}", request with { X = 2000 })).ReadAsync<FurnitureInstanceDto>();
        var invalid = await _client.PostAsync($"/api/rooms/{room.Id}/instances", request with { FurnitureModelId = Guid.NewGuid() });

        Assert.Equal(90, created.RotationY);
        Assert.Equal(2000, moved.X);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/instances/{created.Id}")).StatusCode);
    }

    [Fact]
    public async Task Sync_instances_creates_updates_and_deletes_in_one_call()
    {
        var project = await _client.CreateProjectAsync();
        var room = await _client.CreateRoomAsync(project.Id);
        var modelId = await AnyModelIdAsync();
        var url = $"/api/rooms/{room.Id}/instances";

        var first = await (await _client.PutAsync(url, new SyncInstancesRequest(
        [
            new(null, modelId, 100, 100, 0, null, null),
            new(null, modelId, 200, 200, 0, null, null),
        ]))).ReadAsync<List<FurnitureInstanceDto>>();
        var keptId = first[0].Id;
        var clientGeneratedId = Guid.NewGuid();

        var second = await (await _client.PutAsync(url, new SyncInstancesRequest(
        [
            new(keptId, modelId, 999, 100, 180, null, null),
            new(clientGeneratedId, modelId, 300, 300, 0, null, null),
        ]))).ReadAsync<List<FurnitureInstanceDto>>();

        Assert.Equal(2, first.Count);
        Assert.Equal(2, second.Count);
        Assert.Equal(999, second.Single(instance => instance.Id == keptId).X);
        Assert.Contains(second, instance => instance.Id == clientGeneratedId);
        Assert.DoesNotContain(second, instance => instance.Id == first[1].Id);
    }

    [Fact]
    public async Task Sync_openings_creates_updates_and_deletes_in_one_call()
    {
        var project = await _client.CreateProjectAsync();
        var room = await _client.CreateRoomAsync(project.Id);
        var url = $"/api/rooms/{room.Id}/openings";

        var first = await (await _client.PutAsync(url, new SyncOpeningsRequest(
        [
            new(null, OpeningKind.Door, 0, 500, 830, 2040, 0, HingeSide.Left),
            new(null, OpeningKind.Window, 1, 800, 1200, 1250, 900, null),
        ]))).ReadAsync<List<OpeningDto>>();
        var door = first.Single(opening => opening.Kind == OpeningKind.Door);

        var second = await (await _client.PutAsync(url, new SyncOpeningsRequest(
        [
            new(door.Id, OpeningKind.Door, 2, 1200, 930, 2040, 0, HingeSide.Right),
        ]))).ReadAsync<List<OpeningDto>>();
        var invalid = await _client.PutAsync(url, new SyncOpeningsRequest([new(null, OpeningKind.Door, 9, 0, 830, 2040, 0, null)]));

        Assert.Equal(2, first.Count);
        var kept = Assert.Single(second);
        Assert.Equal(door.Id, kept.Id);
        Assert.Equal(2, kept.WallIndex);
        Assert.Equal(HingeSide.Right, kept.HingeSide);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }

    [Fact]
    public async Task Duplicate_room_copies_openings_and_instances()
    {
        var project = await _client.CreateProjectAsync();
        var room = await _client.CreateRoomAsync(project.Id, "Bureau");
        await _client.PostAsync($"/api/rooms/{room.Id}/openings", new OpeningRequest(OpeningKind.Window, 0, 800, 1200, 1250, 900, null));
        await _client.PostAsync($"/api/rooms/{room.Id}/instances", new FurnitureInstanceRequest(await AnyModelIdAsync(), 500, 500, 0, null, null));

        var copy = await (await _client.PostAsync($"/api/rooms/{room.Id}/duplicate", new { })).ReadAsync<RoomDto>();

        Assert.NotEqual(room.Id, copy.Id);
        Assert.Equal("Bureau (copie)", copy.Name);
        Assert.Single(copy.Openings);
        Assert.Single(copy.Instances);
        Assert.NotEqual(room.Id, copy.Instances[0].RoomId);
    }

    [Fact]
    public async Task Deleting_a_room_removes_its_children_and_a_used_model_is_protected()
    {
        var project = await _client.CreateProjectAsync();
        var room = await _client.CreateRoomAsync(project.Id);
        var modelId = await AnyModelIdAsync();
        var instance = await (await _client.PostAsync($"/api/rooms/{room.Id}/instances",
            new FurnitureInstanceRequest(modelId, 0, 0, 0, null, null))).ReadAsync<FurnitureInstanceDto>();

        var modelDelete = await _client.DeleteAsync($"/api/furniture-models/{modelId}");
        var roomDelete = await _client.DeleteAsync($"/api/rooms/{room.Id}");
        var instanceAfter = await _client.PutAsync($"/api/instances/{instance.Id}", new FurnitureInstanceRequest(modelId, 0, 0, 0, null, null));

        Assert.Equal(HttpStatusCode.Conflict, modelDelete.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, roomDelete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, instanceAfter.StatusCode);
    }
}
