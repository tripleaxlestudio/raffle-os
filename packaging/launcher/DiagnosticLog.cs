using System.Reflection;

namespace Kocokan;

// Best-effort, bounded operational metadata only. Never log exception text,
// runtime output, URLs from users, datasets, event identifiers or payloads.
internal static class DiagnosticLog
{
    private static readonly object Gate = new();
    internal static void Write(string operation)
    {
        try
        {
            lock (Gate)
            {
                var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kocokan", "logs");
                Directory.CreateDirectory(directory);
                var path = Path.Combine(directory, "launcher.log");
                if (File.Exists(path) && new FileInfo(path).Length > 262144)
                    File.Move(path, path + ".previous", overwrite: true);
                var version = Assembly.GetExecutingAssembly().GetName().Version;
                File.AppendAllText(path, $"{DateTimeOffset.UtcNow:O} version={version} {operation}{Environment.NewLine}");
            }
        }
        catch { /* Diagnostics must never prevent launch or shutdown. */ }
    }
}
