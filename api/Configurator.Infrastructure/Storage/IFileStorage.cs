namespace Configurator.Infrastructure.Storage;

public interface IFileStorage
{
    /// <summary>Stores the content and returns its public relative URL.</summary>
    Task<string> SaveAsync(Stream content, string fileName, CancellationToken ct = default);
    Task DeleteAsync(string url, CancellationToken ct = default);
}
