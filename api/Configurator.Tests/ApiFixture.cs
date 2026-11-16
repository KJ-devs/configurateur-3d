using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Configurator.Api.Dtos;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.PostgreSql;

namespace Configurator.Tests;

public class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder().WithImage("postgres:16-alpine").Build();

    public Task InitializeAsync() => _postgres.StartAsync();

    public new Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:Default", _postgres.GetConnectionString());
    }
}

[CollectionDefinition(Name)]
public class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}

public static class HttpClientExtensions
{
    public static readonly List<PointDto> Rectangle = [new(0, 0), new(4000, 0), new(4000, 3000), new(0, 3000)];

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        var value = await response.Content.ReadFromJsonAsync<T>(ApiFixture.Json);
        return value ?? throw new InvalidOperationException("Empty response body.");
    }

    public static Task<HttpResponseMessage> PostAsync<T>(this HttpClient client, string url, T body) =>
        client.PostAsJsonAsync(url, body, ApiFixture.Json);

    public static Task<HttpResponseMessage> PutAsync<T>(this HttpClient client, string url, T body) =>
        client.PutAsJsonAsync(url, body, ApiFixture.Json);

    public static async Task<T> GetAsync<T>(this HttpClient client, string url) =>
        await (await client.GetAsync(url)).ReadAsync<T>();

    public static async Task<ProjectDto> CreateProjectAsync(this HttpClient client, string name = "Appartement") =>
        await (await client.PostAsync("/api/projects", new ProjectRequest(name))).ReadAsync<ProjectDto>();

    public static async Task<RoomDto> CreateRoomAsync(this HttpClient client, Guid projectId, string name = "Salon") =>
        await (await client.PostAsync($"/api/projects/{projectId}/rooms", new RoomRequest(name, Rectangle, 2500, 100, null, null, 0)))
            .ReadAsync<RoomDto>();
}
