using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using Kocokan;
using Microsoft.Win32;

var passed = new List<string>();
void Check(bool condition, string name)
{
    if (!condition) throw new InvalidOperationException("FAIL: " + name);
    passed.Add(name);
    Console.WriteLine("PASS: " + name);
}

var root = Path.Combine(Path.GetTempPath(), "Kocokan Installed");
var executable = Path.Combine(root, "Kocokan.exe");
var matching64 = new FakeRegistry((RegistryHive.LocalMachine, RegistryView.Registry64, root + Path.DirectorySeparatorChar));
Check(new InstalledModeDetector(root, executable, matching64).Detect() == UpdateRuntimeCapability.Installed, "matching HKLM Registry64 install is installed");
Check(new InstalledModeDetector(root, executable, new FakeRegistry()).Detect() == UpdateRuntimeCapability.Portable, "missing registry is portable");
Check(new InstalledModeDetector(root, executable, new FakeRegistry((RegistryHive.LocalMachine, RegistryView.Registry64, null))).Detect() == UpdateRuntimeCapability.Portable, "missing InstallLocation is portable");
Check(new InstalledModeDetector(root, executable, new FakeRegistry((RegistryHive.LocalMachine, RegistryView.Registry64, Path.Combine(Path.GetTempPath(), "Other")))).Detect() == UpdateRuntimeCapability.Portable, "mismatched InstallLocation is portable");
Check(new InstalledModeDetector(root, executable, new FakeRegistry((RegistryHive.LocalMachine, RegistryView.Registry32, root))).Detect() == UpdateRuntimeCapability.Installed, "matching HKLM Registry32 compatibility view is installed");
Check(new InstalledModeDetector(root, executable, new FakeRegistry((RegistryHive.CurrentUser, RegistryView.Registry64, root))).Detect() == UpdateRuntimeCapability.Portable, "HKCU cannot promote current admin installer");
Check(new InstalledModeDetector(root, executable, new FakeRegistry((RegistryHive.LocalMachine, RegistryView.Registry64, "bad\0path"))).Detect() == UpdateRuntimeCapability.Portable, "malformed registry path is portable");
Check(new InstalledModeDetector(root, Path.Combine(Path.GetTempPath(), "Portable", "Kocokan.exe"), matching64).Detect() == UpdateRuntimeCapability.Portable, "executable outside registered root is portable");

var detector = new InstalledModeDetector(root, executable, matching64);
var first = UpdateRuntimeBootstrap.Create(detector);
var second = UpdateRuntimeBootstrap.Create(detector);
Check(Regex.IsMatch(first.MutationToken, "^[A-Za-z0-9_-]{43}$"), "token is 256-bit base64url");
Check(first.MutationToken != second.MutationToken, "new runtime bootstrap gets a new token");
var process = new ProcessStartInfo("node.exe") { UseShellExecute = false };
process.Environment[UpdateRuntimeBootstrap.CapabilityEnvironmentVariable] = "installed";
process.Environment[UpdateRuntimeBootstrap.TokenEnvironmentVariable] = "injected";
first.ApplyTo(process);
Check(process.Environment[UpdateRuntimeBootstrap.CapabilityEnvironmentVariable] == "installed", "launcher passes authoritative installed capability");
Check(process.Environment[UpdateRuntimeBootstrap.TokenEnvironmentVariable] == first.MutationToken, "launcher replaces inherited token for child only");
Check(!string.Join(' ', process.ArgumentList).Contains(first.MutationToken, StringComparison.Ordinal), "token is absent from command line");
Check(!first.ToString().Contains(first.MutationToken, StringComparison.Ordinal), "token is absent from bootstrap diagnostics");

Check(UpdateInstallProtocol.TryParse("{\"type\":\"update-install\",\"version\":\"1.2.3\"}", out var request) && request?.Version == "1.2.3", "strict install handoff accepts exact message");
Check(!UpdateInstallProtocol.TryParse("{\"type\":\"update-install\",\"version\":\"1.2.3\",\"path\":\"evil\"}", out _), "install handoff rejects extra fields");
Check(!UpdateInstallProtocol.TryParse("{\"type\":\"update-install\",\"version\":\"1.2.3\",\"version\":\"2.0.0\"}", out _), "install handoff rejects duplicate fields");
Check(!UpdateInstallProtocol.TryParse("{\"type\":\"update-install\",\"version\":\"../1.2.3\"}", out _), "install handoff rejects invalid version");
Check(!UpdateInstallProtocol.TryParse("{\"type\":\"shutdown\",\"version\":\"1.2.3\"}", out _), "install handoff rejects unknown message type");
Check(!UpdateInstallProtocol.TryParse("not-json", out _), "install handoff rejects malformed JSON");
var prepared = PreparedUpdatePathResolver.Resolve(Path.Combine(Path.GetTempPath(), "LocalAppData"), "1.2.3");
Check(prepared.Installer.EndsWith(Path.Combine("updates", "1.2.3", "Kocokan-Setup-1.2.3.exe"), StringComparison.Ordinal), "launcher derives exact installer path");
Check(prepared.StagedUpdater.EndsWith(Path.Combine("updates", "1.2.3", "Kocokan.Updater.exe"), StringComparison.Ordinal), "launcher derives staged updater path");

Console.WriteLine(JsonSerializer.Serialize(new { passed = passed.Count, tests = passed }));

file sealed class FakeRegistry(params (RegistryHive Hive, RegistryView View, string? Value)[] values) : IInstalledRegistryReader
{
    private readonly Dictionary<(RegistryHive, RegistryView), string?> entries = values.ToDictionary(entry => (entry.Hive, entry.View), entry => entry.Value);
    public string? ReadInstallLocation(RegistryHive hive, RegistryView view) => entries.GetValueOrDefault((hive, view));
}
