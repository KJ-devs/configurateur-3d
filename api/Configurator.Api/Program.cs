using System.Reflection;
using System.Text.Json.Serialization;
using Configurator.Api.Swagger;
using Configurator.Api.Validation;
using Configurator.Infrastructure;
using Configurator.Infrastructure.Persistence;
using FluentValidation;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.EntityFrameworkCore;

const string DevCorsPolicy = "dev";

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' is missing.");
var webRootPath = builder.Environment.WebRootPath ?? Path.Combine(builder.Environment.ContentRootPath, "wwwroot");

builder.Services.AddInfrastructure(connectionString, webRootPath);
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddProblemDetails();
builder.Services
    .AddControllers(options =>
    {
        options.Filters.Add<ValidationFilter>();
        options.OutputFormatters.RemoveType<StringOutputFormatter>();
        foreach (var formatter in options.OutputFormatters.OfType<SystemTextJsonOutputFormatter>())
        {
            formatter.SupportedMediaTypes.Remove("text/json");
        }
    })
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddCors(options => options.AddPolicy(DevCorsPolicy, policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SupportNonNullableReferenceTypes();
    options.SchemaFilter<RequiredNotNullableSchemaFilter>();
    options.CustomOperationIds(api => api.ActionDescriptor.RouteValues["action"]);
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseSwagger();
app.UseSwaggerUI();
app.UseStaticFiles();
app.UseCors(DevCorsPolicy);
app.MapControllers();

// The Swashbuckle CLI boots the app only to read the OpenAPI document: no database there.
var isOpenApiGeneration = Assembly.GetEntryAssembly()?.GetName().Name == "dotnet-swagger";
if (!isOpenApiGeneration)
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);
}

app.Run();

public partial class Program;
