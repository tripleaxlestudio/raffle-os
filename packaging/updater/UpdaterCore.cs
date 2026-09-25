using System.ComponentModel;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Kocokan.Updater;

internal sealed record UpdaterArguments(int LauncherPid, string Version, string InstallRoot)
{
    private static readonly Regex VersionPattern = new(@"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$", RegexOptions.CultureInvariant);
    internal static bool TryParse(string[] args, out UpdaterArguments? parsed)
    {
        parsed = null;
        if (args.Length != 6 || args[0] != "--launcher-pid" || args[2] != "--version" || args[4] != "--install-root" ||
            !int.TryParse(args[1], System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var pid) || pid <= 0 ||
            !VersionPattern.IsMatch(args[3]) || string.IsNullOrWhiteSpace(args[5])) return false;
        parsed = new UpdaterArguments(pid, args[3], args[5]);
        return true;
    }
}

internal sealed record UpdaterPaths(string UpdateRoot, string VersionDirectory, string Installer, string ResultFile, string Launcher);

internal static class UpdaterPathResolver
{
    internal static UpdaterPaths Resolve(UpdaterArguments args, string localAppData, string updaterExecutable)
    {
        if (string.IsNullOrWhiteSpace(localAppData) || !Path.IsPathFullyQualified(localAppData) || !Path.IsPathFullyQualified(args.InstallRoot) || !Path.IsPathFullyQualified(updaterExecutable)) throw new InvalidDataException("Invalid trusted path.");
        var updateRoot = Path.GetFullPath(Path.Combine(localAppData, "Kocokan", "updates"));
        var versionDirectory = Path.GetFullPath(Path.Combine(updateRoot, args.Version));
        var prefix = updateRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!versionDirectory.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Invalid update directory.");
        var expectedUpdater = Path.Combine(versionDirectory, "Kocokan.Updater.exe");
        if (!Path.GetFullPath(updaterExecutable).Equals(expectedUpdater, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Updater is not staged in the authorized directory.");
        var installRoot = Path.GetFullPath(args.InstallRoot);
        if (Path.GetPathRoot(installRoot) == installRoot) throw new InvalidDataException("Invalid install root.");
        return new(updateRoot, versionDirectory, Path.Combine(versionDirectory, $"Kocokan-Setup-{args.Version}.exe"), Path.Combine(updateRoot, "last-update-result.json"), Path.Combine(installRoot, "Kocokan.exe"));
    }
}

internal enum InstallResult { Success, Cancelled, Failed }

internal static class UpdaterApplication
{
    internal const string MutexName = @"Local\Kocokan.Pilot.47882";
    internal static readonly string[] InstallerArguments = ["/SP-", "/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/NOCLOSEAPPLICATIONS", "/NORESTARTAPPLICATIONS"];

    internal static async Task RunAsync(string[] rawArgs)
    {
        if (!UpdaterArguments.TryParse(rawArgs, out var args) || args == null) return;
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        UpdaterPaths paths;
        try { paths = UpdaterPathResolver.Resolve(args, localAppData, Environment.ProcessPath ?? string.Empty); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidDataException) { return; }
        var result = InstallResult.Failed;
        try
        {
            if (await WaitUntilReleasedAsync(args.LauncherPid, TimeSpan.FromSeconds(30)) && File.Exists(paths.Installer))
                result = await RunInstallerAsync(paths.Installer);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException or Win32Exception) { result = InstallResult.Failed; }
        try { await WriteResultAsync(paths.ResultFile, args.Version, result); } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        TryRelaunch(paths.Launcher);
    }

    internal static async Task<bool> WaitUntilReleasedAsync(int launcherPid, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (!ProcessAlive(launcherPid) && !MutexExists() && PortAvailable()) return true;
            await Task.Delay(200);
        }
        return false;
    }

    private static bool ProcessAlive(int pid)
    {
        try { using var process = Process.GetProcessById(pid); return !process.HasExited; }
        catch (ArgumentException) { return false; }
    }
    private static bool MutexExists()
    {
        try { using var mutex = Mutex.OpenExisting(MutexName); return true; }
        catch (WaitHandleCannotBeOpenedException) { return false; }
        catch (UnauthorizedAccessException) { return true; }
    }
    private static bool PortAvailable()
    {
        var listener = new TcpListener(IPAddress.Loopback, 47882); listener.Server.ExclusiveAddressUse = true;
        try { listener.Start(); return true; } catch (SocketException) { return false; } finally { listener.Stop(); }
    }
    internal static async Task<InstallResult> RunInstallerAsync(string installer)
    {
        var info = new ProcessStartInfo(installer) { UseShellExecute = true, Verb = "runas", WorkingDirectory = Path.GetDirectoryName(installer)! };
        foreach (var argument in InstallerArguments) info.ArgumentList.Add(argument);
        try
        {
            using var process = Process.Start(info) ?? throw new InvalidOperationException("Installer did not start.");
            await process.WaitForExitAsync();
            return ClassifyInstallerExitCode(process.ExitCode);
        }
        catch (Win32Exception ex) when (ex.NativeErrorCode == 1223) { return InstallResult.Cancelled; }
    }
    internal static InstallResult ClassifyInstallerExitCode(int exitCode) => exitCode == 0 ? InstallResult.Success : exitCode is 2 or 5 ? InstallResult.Cancelled : InstallResult.Failed;
    internal static async Task WriteResultAsync(string path, string version, InstallResult result)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = path + ".tmp";
        var payload = JsonSerializer.Serialize(new { version, result = result.ToString().ToLowerInvariant(), timestamp = DateTimeOffset.UtcNow.ToString("O") });
        await File.WriteAllTextAsync(temporary, payload);
        File.Move(temporary, path, overwrite: true);
    }
    internal static bool TryRelaunch(string launcher, Func<ProcessStartInfo, Process?>? start = null)
    {
        try
        {
            if (!File.Exists(launcher)) return false;
            (start ?? Process.Start)(new ProcessStartInfo(launcher) { UseShellExecute = true, WorkingDirectory = Path.GetDirectoryName(launcher)! });
            return true;
        }
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException) { return false; }
    }
}
