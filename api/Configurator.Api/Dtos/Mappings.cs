using System.Text.Json;
using Configurator.Domain.Entities;

namespace Configurator.Api.Dtos;

public static class Mappings
{
    public static ProjectDto ToDto(this Project project) =>
        new(project.Id, project.Name, project.ShareCode, project.CreatedAt, project.UpdatedAt);

    public static ProjectDetailDto ToDetailDto(this Project project) =>
        new(project.Id, project.Name, project.ShareCode, project.CreatedAt, project.UpdatedAt,
            project.Rooms.OrderBy(room => room.SortOrder).ThenBy(room => room.CreatedAt).Select(ToDto).ToList());

    public static RoomDto ToDto(this Room room) =>
        new(room.Id, room.ProjectId, room.Name,
            room.FloorPolygon.Select(point => new PointDto(point.X, point.Z)).ToList(),
            room.CeilingHeight, room.WallThickness, room.FloorMaterialId, room.WallMaterialId, room.SortOrder,
            room.PositionX, room.PositionZ, room.GroupName, room.IsHidden,
            room.Openings.OrderBy(opening => opening.CreatedAt).Select(ToDto).ToList(),
            room.Instances.OrderBy(instance => instance.CreatedAt).Select(ToDto).ToList());

    public static void Apply(this RoomRequest request, Room room)
    {
        room.Name = request.Name;
        room.FloorPolygon = request.FloorPolygon.Select(point => new Point2(point.X, point.Z)).ToList();
        room.CeilingHeight = request.CeilingHeight;
        room.WallThickness = request.WallThickness;
        room.FloorMaterialId = request.FloorMaterialId;
        room.WallMaterialId = request.WallMaterialId;
        room.SortOrder = request.SortOrder;
        room.PositionX = request.PositionX;
        room.PositionZ = request.PositionZ;
        room.GroupName = string.IsNullOrWhiteSpace(request.GroupName) ? null : request.GroupName.Trim();
        room.IsHidden = request.IsHidden;
    }

    public static OpeningDto ToDto(this Opening opening) =>
        new(opening.Id, opening.RoomId, opening.Kind, opening.WallIndex, opening.Offset,
            opening.Width, opening.Height, opening.SillHeight, opening.HingeSide);

    public static void Apply(this OpeningRequest request, Opening opening)
    {
        opening.Kind = request.Kind;
        opening.WallIndex = request.WallIndex;
        opening.Offset = request.Offset;
        opening.Width = request.Width;
        opening.Height = request.Height;
        opening.SillHeight = request.SillHeight;
        opening.HingeSide = request.HingeSide;
    }

    public static OpeningRequest ToRequest(this OpeningUpsert upsert) =>
        new(upsert.Kind, upsert.WallIndex, upsert.Offset, upsert.Width, upsert.Height, upsert.SillHeight, upsert.HingeSide);

    public static MaterialDto ToDto(this Material material) =>
        new(material.Id, material.Name, material.Kind, material.ColorHex, material.TextureUrl,
            material.Thicknesses, material.Depths, material.PricePerM2);

    public static void Apply(this MaterialRequest request, Material material)
    {
        material.Name = request.Name;
        material.Kind = request.Kind;
        material.ColorHex = request.ColorHex;
        material.TextureUrl = request.TextureUrl;
        material.Thicknesses = request.Thicknesses;
        material.Depths = request.Depths;
        material.PricePerM2 = request.PricePerM2;
    }

    public static FurnitureModelDto ToDto(this FurnitureModel model) =>
        new(model.Id, model.Name, model.Category, model.Type, model.Width, model.Height, model.Depth,
            model.AssetUrl, ToJsonElement(model.ParametricDefinition), model.ThumbnailUrl, model.BasePrice, model.MaterialId);

    public static void Apply(this FurnitureModelRequest request, FurnitureModel model)
    {
        model.Name = request.Name;
        model.Category = request.Category;
        model.Type = request.Type;
        model.Width = request.Width;
        model.Height = request.Height;
        model.Depth = request.Depth;
        model.AssetUrl = request.AssetUrl;
        model.ParametricDefinition = request.ParametricDefinition?.GetRawText();
        model.ThumbnailUrl = request.ThumbnailUrl;
        model.BasePrice = request.BasePrice;
        model.MaterialId = request.MaterialId;
    }

    public static FurnitureInstanceDto ToDto(this FurnitureInstance instance) =>
        new(instance.Id, instance.RoomId, instance.FurnitureModelId, instance.X, instance.Z, instance.RotationY,
            instance.ColorOverride, ToJsonElement(instance.ParametricOverride));

    public static void Apply(this FurnitureInstanceRequest request, FurnitureInstance instance)
    {
        instance.FurnitureModelId = request.FurnitureModelId;
        instance.X = request.X;
        instance.Z = request.Z;
        instance.RotationY = request.RotationY;
        instance.ColorOverride = request.ColorOverride;
        instance.ParametricOverride = request.ParametricOverride?.GetRawText();
    }

    public static FurnitureInstanceRequest ToRequest(this FurnitureInstanceUpsert upsert) =>
        new(upsert.FurnitureModelId, upsert.X, upsert.Z, upsert.RotationY, upsert.ColorOverride, upsert.ParametricOverride);

    private static JsonElement? ToJsonElement(string? json) =>
        json is null ? null : JsonSerializer.Deserialize<JsonElement>(json);
}
