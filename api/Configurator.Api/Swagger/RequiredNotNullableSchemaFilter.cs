using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Configurator.Api.Swagger;

/// <summary>Marks every non-nullable property as required so the generated TS client has no spurious optionals.</summary>
public class RequiredNotNullableSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema.Properties is null) return;

        foreach (var (name, property) in schema.Properties)
        {
            if (!property.Nullable) schema.Required.Add(name);
        }
    }
}
