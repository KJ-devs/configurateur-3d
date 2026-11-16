namespace Configurator.Infrastructure.Storage;

public class LocalFileStorage(string webRootPath) : IFileStorage
{
    private const string UploadsFolder = "uploads";

    public async Task<string> SaveAsync(Stream content, string fileName, CancellationToken ct = default)
    {
        var directory = Path.Combine(webRootPath, UploadsFolder);
        Directory.CreateDirectory(directory);
        var storedName = $"{Guid.NewGuid():N}{Path.GetExtension(fileName).ToLowerInvariant()}";
        await using var file = File.Create(Path.Combine(directory, storedName));
        await content.CopyToAsync(file, ct);
        return $"/{UploadsFolder}/{storedName}";
    }

    public Task DeleteAsync(string url, CancellationToken ct = default)
    {
        var path = Path.Combine(webRootPath, UploadsFolder, Path.GetFileName(url));
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }
}
