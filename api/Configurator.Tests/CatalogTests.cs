using System.Net;
using System.Text.Json;
using Configurator.Api.Dtos;
using Configurator.Domain.Entities;
using Configurator.Infrastructure.Persistence;

namespace Configurator.Tests;

[Collection(ApiCollection.Name)]
public class CatalogTests(ApiFixture fixture)
{
    private readonly HttpClient _client = fixture.CreateClient();

    [Fact]
    public async Task Seed_provides_materials_and_furniture_models()
    {
        var materials = await _client.GetAsync<List<MaterialDto>>("/api/materials");
        var models = await _client.GetAsync<List<FurnitureModelDto>>("/api/furniture-models");

        Assert.True(materials.Count(material => material.Kind is MaterialKind.Wood or MaterialKind.Lacquer) >= 4);
        Assert.True(models.Count >= 10);
        Assert.Contains(models, model => model.Type == FurnitureType.Asset);
        Assert.All(models.Where(model => model.Type == FurnitureType.Parametric), model =>
        {
            Assert.NotNull(model.ParametricDefinition);
            Assert.Equal(model.Width, model.ParametricDefinition.Value.GetProperty("width").GetInt32());
            Assert.Equal("root", model.ParametricDefinition.Value.GetProperty("root").GetProperty("id").GetString());
        });
    }

    [Fact]
    public async Task Furniture_models_can_be_filtered_by_search_and_category()
    {
        var bySearch = await _client.GetAsync<List<FurnitureModelDto>>("/api/furniture-models?search=biblio");
        var byCategory = await _client.GetAsync<List<FurnitureModelDto>>("/api/furniture-models?category=Salon");
        var categories = await _client.GetAsync<List<string>>("/api/furniture-models/categories");

        Assert.Contains(bySearch, model => model.Name.StartsWith("Bibliothèque"));
        Assert.All(bySearch, model => Assert.Contains("biblio", model.Name, StringComparison.OrdinalIgnoreCase));
        Assert.NotEmpty(byCategory);
        Assert.All(byCategory, model => Assert.Equal("Salon", model.Category));
        Assert.Contains("Rangement", categories);
    }

    [Fact]
    public async Task Material_crud_roundtrip()
    {
        var request = new MaterialRequest("Hêtre", MaterialKind.Wood, "#e0c9a6", null, [18, 25], [300, 400], 72.5m);

        var created = await (await _client.PostAsync("/api/materials", request)).ReadAsync<MaterialDto>();
        var updated = await (await _client.PutAsync($"/api/materials/{created.Id}", request with { PricePerM2 = 80m })).ReadAsync<MaterialDto>();
        var deleted = await _client.DeleteAsync($"/api/materials/{created.Id}");
        var afterDelete = await _client.GetAsync($"/api/materials/{created.Id}");

        Assert.Equal([18, 25], created.Thicknesses);
        Assert.Equal(80m, updated.PricePerM2);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, afterDelete.StatusCode);
    }

    [Fact]
    public async Task Material_with_invalid_color_is_rejected_with_problem_details()
    {
        var request = new MaterialRequest("Rouge", MaterialKind.Lacquer, "red", null, [18], [300], 10m);

        var response = await _client.PostAsync("/api/materials", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("ColorHex", problem);
    }

    [Fact]
    public async Task Material_used_by_a_model_cannot_be_deleted()
    {
        var response = await _client.DeleteAsync($"/api/materials/{DbSeeder.OakId}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Parametric_model_requires_a_definition()
    {
        var request = new FurnitureModelRequest("Sans définition", "Rangement", FurnitureType.Parametric,
            800, 2000, 300, null, null, null, null, DbSeeder.OakId);

        var response = await _client.PostAsync("/api/furniture-models", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Parametric_model_roundtrips_its_definition()
    {
        var definition = JsonSerializer.Deserialize<JsonElement>(
            """{"schemaVersion":1,"width":600,"height":900,"depth":400,"panelThickness":18,"hasBack":true,"plinthHeight":0,"root":{"id":"root","type":"leaf","content":{"kind":"shelf","count":2}}}""");
        var request = new FurnitureModelRequest("Colonne", "Rangement", FurnitureType.Parametric,
            600, 900, 400, null, definition, null, null, DbSeeder.OakId);

        var created = await (await _client.PostAsync("/api/furniture-models", request)).ReadAsync<FurnitureModelDto>();
        var fetched = await _client.GetAsync<FurnitureModelDto>($"/api/furniture-models/{created.Id}");

        Assert.Equal(2, fetched.ParametricDefinition!.Value.GetProperty("root").GetProperty("content").GetProperty("count").GetInt32());
        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/furniture-models/{created.Id}")).StatusCode);
    }
}
