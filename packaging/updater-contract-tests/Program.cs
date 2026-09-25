using System.Text.Json;
using Kocokan.Updater;

var passed = new List<string>();
void Check(bool value, string name) { if (!value) throw new InvalidOperationException("FAIL: " + name); passed.Add(name); Console.WriteLine("PASS: " + name); }

Check(UpdaterArguments.TryParse(["--launcher-pid", "42", "--version", "1.2.3", "--install-root", @"C:\Program Files\Kocokan"], out var arguments) && arguments?.LauncherPid == 42, "strict updater arguments accepted");
Check(!UpdaterArguments.TryParse(["--version", "1.2.3", "--launcher-pid", "42", "--install-root", @"C:\Program Files\Kocokan"], out _), "reordered arguments rejected");
Check(!UpdaterArguments.TryParse(["--launcher-pid", "42", "--version", "../1.2.3", "--install-root", @"C:\Program Files\Kocokan"], out _), "unsafe version rejected");
Check(!UpdaterArguments.TryParse(["--launcher-pid", "42", "--version", "1.2.3", "--install-root", @"C:\Program Files\Kocokan", "--url", "x"], out _), "extra updater arguments rejected");

var local = Path.Combine(Path.GetTempPath(), "KocokanUpdaterContract", Guid.NewGuid().ToString("N"));
var versionDirectory = Path.Combine(local, "Kocokan", "updates", "1.2.3");
var updater = Path.Combine(versionDirectory, "Kocokan.Updater.exe");
Directory.CreateDirectory(versionDirectory);
var paths = UpdaterPathResolver.Resolve(arguments!, local, updater);
Check(paths.Installer == Path.Combine(versionDirectory, "Kocokan-Setup-1.2.3.exe"), "installer path is derived from version");
var escaped = false;
try { UpdaterPathResolver.Resolve(arguments!, local, Path.Combine(local, "Kocokan.Updater.exe")); } catch (InvalidDataException) { escaped = true; }
Check(escaped, "updater outside version directory rejected");
Check(UpdaterApplication.InstallerArguments.SequenceEqual(["/SP-", "/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/NOCLOSEAPPLICATIONS", "/NORESTARTAPPLICATIONS"]), "installer uses exact non-very-silent flags");
Check(UpdaterApplication.ClassifyInstallerExitCode(0) == InstallResult.Success, "installer zero is success");
Check(UpdaterApplication.ClassifyInstallerExitCode(2) == InstallResult.Cancelled && UpdaterApplication.ClassifyInstallerExitCode(5) == InstallResult.Cancelled, "documented Inno cancel exits are cancelled");
Check(UpdaterApplication.ClassifyInstallerExitCode(1) == InstallResult.Failed && UpdaterApplication.ClassifyInstallerExitCode(9) == InstallResult.Failed, "other nonzero installer exits fail");
Check(!await UpdaterApplication.WaitUntilReleasedAsync(Environment.ProcessId, TimeSpan.FromMilliseconds(20)), "bounded wait fails while launcher PID remains alive");

await UpdaterApplication.WriteResultAsync(paths.ResultFile, "1.2.3", InstallResult.Cancelled);
using var result = JsonDocument.Parse(await File.ReadAllTextAsync(paths.ResultFile));
Check(result.RootElement.EnumerateObject().Count() == 3, "result file has only three fields");
Check(result.RootElement.GetProperty("result").GetString() == "cancelled", "cancel result is explicit");
var launcher = Path.Combine(versionDirectory, "Kocokan.exe");
await File.WriteAllTextAsync(launcher, "fixture");
var relaunches = 0;
Check(UpdaterApplication.TryRelaunch(launcher, _ => { relaunches++; return null; }) && relaunches == 1, "terminal flow requests exactly one launcher relaunch");
Directory.Delete(local, recursive: true);
Console.WriteLine(JsonSerializer.Serialize(new { passed = passed.Count, tests = passed }));
