using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Kocokan;

internal sealed record UpdateInstallRequest(string Version);

internal static partial class UpdateInstallProtocol
{
    [GeneratedRegex(@"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$", RegexOptions.CultureInvariant)]
    private static partial Regex VersionPattern();

    public static bool TryParse(string line, out UpdateInstallRequest? request)
    {
        request = null;
        if (string.IsNullOrEmpty(line) || line.Length > 256) return false;
        try
        {
            using var document = JsonDocument.Parse(line, new JsonDocumentOptions { AllowTrailingCommas = false, CommentHandling = JsonCommentHandling.Disallow });
            if (document.RootElement.ValueKind != JsonValueKind.Object) return false;
            string? type = null;
            string? version = null;
            var names = new HashSet<string>(StringComparer.Ordinal);
            var count = 0;
            foreach (var property in document.RootElement.EnumerateObject())
            {
                count++;
                if (!names.Add(property.Name) || property.Value.ValueKind != JsonValueKind.String) return false;
                if (property.NameEquals("type")) type = property.Value.GetString();
                else if (property.NameEquals("version")) version = property.Value.GetString();
                else return false;
            }
            if (count != 2 || type != "update-install" || version == null || !VersionPattern().IsMatch(version)) return false;
            request = new UpdateInstallRequest(version);
            return true;
        }
        catch (JsonException) { return false; }
    }
}

internal sealed record PreparedUpdatePaths(string Directory, string Installer, string StagedUpdater);

internal static class PreparedUpdatePathResolver
{
    public static PreparedUpdatePaths Resolve(string localAppData, string version)
    {
        if (string.IsNullOrWhiteSpace(localAppData) || !Path.IsPathFullyQualified(localAppData)) throw new InvalidDataException("Lokasi pembaruan tidak valid.");
        if (!UpdateInstallProtocol.TryParse(JsonSerializer.Serialize(new { type = "update-install", version }), out _))
            throw new InvalidDataException("Versi pembaruan tidak valid.");
        var updateRoot = Path.GetFullPath(Path.Combine(localAppData, "Kocokan", "updates"));
        var directory = Path.GetFullPath(Path.Combine(updateRoot, version));
        var prefix = updateRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!directory.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Lokasi pembaruan tidak valid.");
        return new PreparedUpdatePaths(directory, Path.Combine(directory, $"Kocokan-Setup-{version}.exe"), Path.Combine(directory, "Kocokan.Updater.exe"));
    }
}

internal interface IUpdaterProcess : IDisposable
{
    bool HasExited { get; }
    void Kill();
}

internal interface IUpdaterSpawner
{
    IUpdaterProcess Start(string executable, int launcherPid, string version, string installRoot);
}

internal sealed class UpdaterSpawner : IUpdaterSpawner
{
    public IUpdaterProcess Start(string executable, int launcherPid, string version, string installRoot)
    {
        var info = new ProcessStartInfo(executable) { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(executable)! };
        info.ArgumentList.Add("--launcher-pid"); info.ArgumentList.Add(launcherPid.ToString(System.Globalization.CultureInfo.InvariantCulture));
        info.ArgumentList.Add("--version"); info.ArgumentList.Add(version);
        info.ArgumentList.Add("--install-root"); info.ArgumentList.Add(installRoot);
        var process = Process.Start(info) ?? throw new InvalidOperationException("Updater gagal dijalankan.");
        return new UpdaterProcess(process);
    }

    private sealed class UpdaterProcess(Process process) : IUpdaterProcess
    {
        public bool HasExited => process.HasExited;
        public void Kill() { if (!process.HasExited) process.Kill(entireProcessTree: true); }
        public void Dispose() => process.Dispose();
    }
}
