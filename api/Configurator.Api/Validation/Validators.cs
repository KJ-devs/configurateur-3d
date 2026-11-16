using System.Text.Json;
using Configurator.Api.Dtos;
using Configurator.Domain.Entities;
using FluentValidation;

namespace Configurator.Api.Validation;

public static class ValidationRules
{
    public const string HexColorPattern = "^#[0-9a-fA-F]{6}$";

    public static bool IsJsonObject(JsonElement? element) => element is { ValueKind: JsonValueKind.Object };
}

public class ProjectRequestValidator : AbstractValidator<ProjectRequest>
{
    public ProjectRequestValidator()
    {
        RuleFor(request => request.Name).NotEmpty().MaximumLength(200);
    }
}

public class RoomRequestValidator : AbstractValidator<RoomRequest>
{
    public RoomRequestValidator()
    {
        RuleFor(request => request.Name).NotEmpty().MaximumLength(200);
        RuleFor(request => request.FloorPolygon).NotNull().Must(points => points is { Count: >= 3 })
            .WithMessage("The floor polygon needs at least 3 points.");
        RuleFor(request => request.CeilingHeight).InclusiveBetween(1800, 6000);
        RuleFor(request => request.WallThickness).InclusiveBetween(50, 500);
    }
}

public class OpeningRequestValidator : AbstractValidator<OpeningRequest>
{
    public OpeningRequestValidator()
    {
        RuleFor(request => request.Kind).IsInEnum();
        RuleFor(request => request.WallIndex).GreaterThanOrEqualTo(0);
        RuleFor(request => request.Offset).GreaterThanOrEqualTo(0);
        RuleFor(request => request.Width).InclusiveBetween(300, 5000);
        RuleFor(request => request.Height).InclusiveBetween(300, 4000);
        RuleFor(request => request.SillHeight).GreaterThanOrEqualTo(0);
    }
}

public class MaterialRequestValidator : AbstractValidator<MaterialRequest>
{
    public MaterialRequestValidator()
    {
        RuleFor(request => request.Name).NotEmpty().MaximumLength(200);
        RuleFor(request => request.Kind).IsInEnum();
        RuleFor(request => request.ColorHex).NotEmpty().Matches(ValidationRules.HexColorPattern);
        RuleFor(request => request.Thicknesses).NotNull();
        RuleFor(request => request.Depths).NotNull();
        RuleFor(request => request.PricePerM2).GreaterThanOrEqualTo(0);
    }
}

public class FurnitureModelRequestValidator : AbstractValidator<FurnitureModelRequest>
{
    public FurnitureModelRequestValidator()
    {
        RuleFor(request => request.Name).NotEmpty().MaximumLength(200);
        RuleFor(request => request.Category).NotEmpty().MaximumLength(100);
        RuleFor(request => request.Type).IsInEnum();
        RuleFor(request => request.Width).InclusiveBetween(1, 10000);
        RuleFor(request => request.Height).InclusiveBetween(1, 10000);
        RuleFor(request => request.Depth).InclusiveBetween(1, 10000);
        RuleFor(request => request.BasePrice).GreaterThanOrEqualTo(0);

        When(request => request.Type == FurnitureType.Parametric, () =>
        {
            RuleFor(request => request.ParametricDefinition).Must(ValidationRules.IsJsonObject)
                .WithMessage("A parametric model needs a ParametricDefinition object.");
            RuleFor(request => request.MaterialId).NotNull();
        });
        When(request => request.Type == FurnitureType.Asset, () =>
        {
            RuleFor(request => request.ParametricDefinition).Must(definition => definition is null)
                .WithMessage("An asset model cannot carry a ParametricDefinition.");
        });
    }
}

public class FurnitureInstanceRequestValidator : AbstractValidator<FurnitureInstanceRequest>
{
    public FurnitureInstanceRequestValidator()
    {
        RuleFor(request => request.FurnitureModelId).NotEmpty();
        RuleFor(request => request.ColorOverride).Matches(ValidationRules.HexColorPattern);
        RuleFor(request => request.ParametricOverride)
            .Must(definition => definition is null || ValidationRules.IsJsonObject(definition))
            .WithMessage("ParametricOverride must be a JSON object.");
    }
}

public class SyncInstancesRequestValidator : AbstractValidator<SyncInstancesRequest>
{
    public SyncInstancesRequestValidator()
    {
        RuleFor(request => request.Instances).NotNull();
        RuleForEach(request => request.Instances)
            .Must(upsert => upsert.FurnitureModelId != Guid.Empty)
            .WithMessage("FurnitureModelId is required.");
        RuleForEach(request => request.Instances)
            .Must(upsert => upsert.ParametricOverride is null || ValidationRules.IsJsonObject(upsert.ParametricOverride))
            .WithMessage("ParametricOverride must be a JSON object.");
    }
}
