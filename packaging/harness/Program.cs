using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Kocokan;

if (args.Length != 1) throw new ArgumentException("Usage: harness <portable-folder>");
var package = Path.GetFullPath(args[0]);
if (!RuntimeController.PortAvailable()) throw new InvalidOperationException("Harness requires free port 47882; no existing process will be stopped.");
var passed = new List<string>();
void Check(bool condition, string name)
{
    if (!condition) throw new InvalidOperationException("FAIL: " + name);
    passed.Add(name);
    Console.WriteLine("PASS: " + name);
}
async Task Wait(Func<bool> condition)
{
    var deadline = Stopwatch.StartNew();
    while (!condition()) { if (deadline.Elapsed.TotalSeconds > 10) throw new TimeoutException(); await Task.Delay(100); }
}
using (var runtime = new RuntimeController(package))
{
    try
    {
        await runtime.StartAsync();
        Check(runtime.State == RuntimeState.Running, "real bundled runtime readiness");
        Check(runtime.ChildId != null, "launcher owns a running child");
        using var http = new HttpClient();
        foreach (var route in new[] { "/", "/dashboard", "/display?eventId=pilot-test&displayConfigurationId=pilot-display" })
            Check((await http.GetAsync(RuntimeController.Origin + route)).IsSuccessStatusCode, "portable route " + route);
        using var ownChild = Process.GetProcessById(runtime.ChildId!.Value);
        ownChild.Kill();
        await Wait(() => runtime.State == RuntimeState.Error);
        Check(runtime.State == RuntimeState.Error, "child crash becomes Error without auto restart");
        await runtime.StartAsync();
        Check(runtime.State == RuntimeState.Running, "Retry recovers after crash");
    }
    finally { await runtime.StopAsync(); }
    Check(!runtime.ForcedLastStop && RuntimeController.PortAvailable(), "graceful stdin shutdown and port reuse");
}
var occupied = new TcpListener(IPAddress.Loopback, 47882);
occupied.Start();
try
{
    using var runtime = new RuntimeController(package);
    await runtime.StartAsync();
    Check(runtime.State == RuntimeState.Error && runtime.Message == RuntimeController.Conflict && runtime.ChildId == null, "port conflict never spawns or kills an unrelated process");
    Check(occupied.Server.IsBound, "conflicting listener remains alive");
    occupied.Stop();
    await runtime.StartAsync();
    Check(runtime.State == RuntimeState.Running, "Retry recovers after port release");
    await runtime.StopAsync();
}
finally { occupied.Stop(); }

// Fault injection only for failure modes. Success above always uses the real
// packaged bundle; production has no test CLI or readiness bypass.
var faultRoot = Path.Combine(Path.GetTempPath(), "kocokan-p2-fault-" + Guid.NewGuid());
Directory.CreateDirectory(Path.Combine(faultRoot, "runtime"));
Directory.CreateDirectory(Path.Combine(faultRoot, "server"));
File.Copy(Path.Combine(package, "runtime", "node.exe"), Path.Combine(faultRoot, "runtime", "node.exe"));
File.Copy(Path.Combine(package, "manifest.json"), Path.Combine(faultRoot, "manifest.json"));
try
{
    await File.WriteAllTextAsync(Path.Combine(faultRoot, "server", "kocokan-server.cjs"), "setInterval(()=>{},1000); process.stdin.resume();");
    using (var stalled = new RuntimeController(faultRoot, TimeSpan.FromMilliseconds(700), TimeSpan.FromMilliseconds(200)))
    {
        await stalled.StartAsync();
        Check(stalled.State == RuntimeState.Error && stalled.Message.Contains("timeout"), "readiness timeout remains Error");
        Check(stalled.ForcedLastStop && stalled.ChildId == null, "forced fallback terminates only owned unresponsive child");
    }
    using (var cancelled = new RuntimeController(faultRoot, stopTimeout: TimeSpan.FromMilliseconds(200)))
    {
        var starting = cancelled.StartAsync();
        await Task.Delay(150);
        await cancelled.StopAsync();
        await starting;
        Check(cancelled.State == RuntimeState.Stopping && cancelled.ChildId == null, "Quit during Starting cancels readiness and reaps child");
    }
    using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine(package, "manifest.json")));
    var version = manifest.RootElement.GetProperty("runtimeVersion").GetString();
    var readyLine = JsonSerializer.Serialize(new { type = "ready", origin = RuntimeController.Origin, version });
    await File.WriteAllTextAsync(Path.Combine(faultRoot, "server", "kocokan-server.cjs"),
        "require('http').createServer((q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify({application:'foreign',version:'wrong',ready:true,status:'running'}))}).listen(47882,'127.0.0.1',()=>console.log(" + JsonSerializer.Serialize(readyLine) + "));process.stdin.resume();process.stdin.on('data',()=>process.exit(0));");
    using (var impostor = new RuntimeController(faultRoot, TimeSpan.FromMilliseconds(1200)))
    {
        await impostor.StartAsync();
        Check(impostor.State == RuntimeState.Error, "HTTP 200 ready=true with wrong identity/version rejected");
    }
}
finally { Directory.Delete(faultRoot, true); }

// Exercise the actual packaged executable and its OS mutex/job, not a mock.
using (var launcher = Process.Start(new ProcessStartInfo(Path.Combine(package, "Kocokan.exe")) { WorkingDirectory = Path.GetTempPath(), UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden })!)
{
    try
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        var ready = false;
        for (var attempt = 0; attempt < 100 && !ready; attempt++)
        {
            try { ready = (await http.GetAsync(RuntimeController.Origin + "/health")).IsSuccessStatusCode; }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { }
            await Task.Delay(100);
        }
        Check(ready, "packaged Kocokan.exe starts from unrelated working directory");
        using var duplicate = Process.Start(new ProcessStartInfo(Path.Combine(package, "Kocokan.exe")) { UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden })!;
        await duplicate.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));
        Check(duplicate.ExitCode == 0 && !launcher.HasExited, "duplicate launcher exits and existing instance survives");
    }
    finally { if (!launcher.HasExited) launcher.Kill(); await launcher.WaitForExitAsync(); }
}
await Wait(RuntimeController.PortAvailable);
Check(RuntimeController.PortAvailable(), "abnormal launcher death leaves no listener via Job Object/EOF");
Console.WriteLine(JsonSerializer.Serialize(new { passed = passed.Count, tests = passed }));
