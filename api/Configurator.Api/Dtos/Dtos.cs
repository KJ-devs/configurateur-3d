using System.Text.Json;
using Configurator.Domain.Entities;

namespace Configurator.Api.Dtos;

public record PointDto(double X, double Z);

public record ProjectDto(Guid Id, string Name, string ShareCode, DateTime CreatedAt, DateTime UpdatedAt);

public record ProjectDetailDto(Guid Id, string Name, string ShareCode, DateTime CreatedAt, DateTime UpdatedAt, List<RoomDto> Rooms);

public record ProjectRequest(string Name);

public record RoomDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    List<PointDto> FloorPolygon,
    int CeilingHeight,
    int WallThickness,
    Guid? FloorMaterialId,
    Guid? WallMaterialId,
    int SortOrder,
    double PositionX,
    double PositionZ,
    string? GroupName,
    bool IsHidden,
    List<OpeningDto> Openings,
    List<FurnitureInstanceDto> Instances);

/// <summary>Position, group and visibility are optional so older clients keep working.</summary>
public record RoomRequest(
    string Name,
    List<PointDto> FloorPolygon,
    int CeilingHeight,
    int WallThickness,
    Guid? FloorMaterialId,
    Guid? WallMaterialId,
    int SortOrder,
    double PositionX = 0,
    double PositionZ = 0,
    string? GroupName = null,
    bool IsHidden = false);

public record OpeningDto(
    Guid Id,
    Guid RoomId,
    OpeningKind Kind,
    int WallIndex,
    double Offset,
    int Width,
    int Height,
    int SillHeight,
    HingeSide? HingeSide);

public record OpeningRequest(
    OpeningKind Kind,
    int WallIndex,
    double Offset,
    int Width,
    int Height,
    int SillHeight,
    HingeSide? HingeSide);

/// <summary>One opening of a room-wide sync. A null Id creates a new opening.</summary>
public record OpeningUpsert(
    Guid? Id,
    OpeningKind Kind,
    int WallIndex,
    double Offset,
    int Width,
    int Height,
    int SillHeight,
    HingeSide? HingeSide);

/// <summary>Replaces the whole opening list of a room: missing ids are deleted.</summary>
public record SyncOpeningsRequest(List<OpeningUpsert> Openings);

public record MaterialDto(
    Guid Id,
    string Name,
    MaterialKind Kind,
    string ColorHex,
    string? TextureUrl,
    int[] Thicknesses,
    int[] Depths,
    decimal PricePerM2);

public record MaterialRequest(
    string Name,
    MaterialKind Kind,
    string ColorHex,
    string? TextureUrl,
    int[] Thicknesses,
    int[] Depths,
    decimal PricePerM2);

public record FurnitureModelDto(
    Guid Id,
    string Name,
    string Category,
    FurnitureType Type,
    int Width,
    int Height,
    int Depth,
    string? AssetUrl,
    JsonElement? ParametricDefinition,
    string? ThumbnailUrl,
    decimal? BasePrice,
    Guid? MaterialId);

public record FurnitureModelRequest(
    string Name,
    string Category,
    FurnitureType Type,
    int Width,
    int Height,
    int Depth,
    string? AssetUrl,
    JsonElement? ParametricDefinition,
    string? ThumbnailUrl,
    decimal? BasePrice,
    Guid? MaterialId);

public record FurnitureInstanceDto(
    Guid Id,
    Guid RoomId,
    Guid FurnitureModelId,
    double X,
    double Z,
    double RotationY,
    string? ColorOverride,
    JsonElement? ParametricOverride);

public record FurnitureInstanceRequest(
    Guid FurnitureModelId,
    double X,
    double Z,
    double RotationY,
    string? ColorOverride,
    JsonElement? ParametricOverride);

/// <summary>One instance of a room-wide sync. A null Id creates a new instance.</summary>
public record FurnitureInstanceUpsert(
    Guid? Id,
    Guid FurnitureModelId,
    double X,
    double Z,
    double RotationY,
    string? ColorOverride,
    JsonElement? ParametricOverride);

/// <summary>Replaces the whole instance list of a room: missing ids are deleted.</summary>
public record SyncInstancesRequest(List<FurnitureInstanceUpsert> Instances);
