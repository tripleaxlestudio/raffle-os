using Microsoft.Win32;

namespace Kocokan;

internal interface IInstalledRegistryReader
{
    string? ReadInstallLocation(RegistryHive hive, RegistryView view);
}

internal sealed class WindowsInstalledRegistryReader : IInstalledRegistryReader
{
    internal const string UninstallSubKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{5F39F696-B62A-49CA-A090-366BE7E49213}_is1";

    public string? ReadInstallLocation(RegistryHive hive, RegistryView view)
    {
        using var baseKey = RegistryKey.OpenBaseKey(hive, view);
        using var uninstallKey = baseKey.OpenSubKey(UninstallSubKey, writable: false);
        return uninstallKey?.GetValue("InstallLocation", null, RegistryValueOptions.DoNotExpandEnvironmentNames) as string;
    }
}

internal enum UpdateRuntimeCapability { Portable, Installed }

internal sealed class InstalledModeDetector
{
    private static readonly RegistryView[] SupportedViews = [RegistryView.Registry64, RegistryView.Registry32];
    private readonly string launcherRoot;
    private readonly string launcherExecutablePath;
    private readonly IInstalledRegistryReader registry;

    internal InstalledModeDetector(string launcherRoot, string launcherExecutablePath, IInstalledRegistryReader registry)
    {
        this.launcherRoot = launcherRoot;
        this.launcherExecutablePath = launcherExecutablePath;
        this.registry = registry;
    }

    internal static InstalledModeDetector CreateForCurrentProcess(string launcherRoot)
    {
        return new InstalledModeDetector(launcherRoot, Environment.ProcessPath ?? string.Empty, new WindowsInstalledRegistryReader());
    }

    internal UpdateRuntimeCapability Detect()
    {
        try
        {
            var resolvedRoot = NormalizeDirectory(launcherRoot);
            var executableDirectory = NormalizeDirectory(Path.GetDirectoryName(Path.GetFullPath(launcherExecutablePath)) ?? string.Empty);
            if (resolvedRoot is null || executableDirectory is null || !SamePath(resolvedRoot, executableDirectory)) return UpdateRuntimeCapability.Portable;

            // The current admin/x64 Inno installer writes HKLM Registry64. The
            // 32-bit HKLM view is checked for compatibility, but HKCU is not an
            // authority for this PrivilegesRequired=admin installation.
            foreach (var view in SupportedViews)
            {
                var installLocation = NormalizeDirectory(registry.ReadInstallLocation(RegistryHive.LocalMachine, view));
                if (installLocation is not null && SamePath(resolvedRoot, installLocation)) return UpdateRuntimeCapability.Installed;
            }
        }
        catch (Exception ex) when (ex is ArgumentException or IOException or UnauthorizedAccessException or System.Security.SecurityException)
        {
            // Registry/path ambiguity must never enable native update behavior.
        }
        return UpdateRuntimeCapability.Portable;
    }

    private static string? NormalizeDirectory(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.IndexOf('\0') >= 0) return null;
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(value));
    }

    private static bool SamePath(string left, string right) => string.Equals(left, right, StringComparison.OrdinalIgnoreCase);
}
