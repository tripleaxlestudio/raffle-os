using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;

namespace Kocokan;

internal enum RuntimeState { Starting, Running, Error, Stopping }

internal sealed class RuntimeController : IDisposable
{
    public const string Origin = "http://127.0.0.1:47882";
    public const string Conflict = "Port 47882 sedang digunakan aplikasi lain.";
    private readonly string root;
    private readonly TimeSpan startupTimeout;
    private readonly TimeSpan stopTimeout;
    private readonly HttpClient http = new(new HttpClientHandler { UseProxy = false }) { Timeout = TimeSpan.FromMilliseconds(700) };
    private Process? child;
    private ChildJob? job;
    private CancellationTokenSource? starting;
    private Task? startTask;
    private bool stopping;
    private string errorOutput = "";
    public RuntimeState State { get; private set; } = RuntimeState.Starting;
    public string Message { get; private set; } = "";
    public int? ChildId => child is { HasExited: false } ? child.Id : null;
    public bool ForcedLastStop { get; private set; }
    public event Action? Changed;

    public RuntimeController(string root, TimeSpan? startupTimeout = null, TimeSpan? stopTimeout = null)
    {
        this.root = root;
        this.startupTimeout = startupTimeout ?? TimeSpan.FromSeconds(20);
        this.stopTimeout = stopTimeout ?? TimeSpan.FromSeconds(5);
    }
    private void Set(RuntimeState state, string message)
    { State = state; Message = message; Changed?.Invoke(); }
    public static bool PortAvailable()
    {
        var listener = new TcpListener(IPAddress.Loopback, 47882);
        listener.Server.ExclusiveAddressUse = true;
        try { listener.Start(); return true; }
        catch (SocketException) { return false; }
        finally { listener.Stop(); }
    }
    public Task StartAsync()
    {
        if (startTask is { IsCompleted: false } || stopping || ChildId != null) return startTask ?? Task.CompletedTask;
        startTask = StartCoreAsync();
        return startTask;
    }
    private async Task StartCoreAsync()
    {
        starting?.Dispose();
        starting = new CancellationTokenSource(startupTimeout);
        var cancellation = starting.Token;
        Set(RuntimeState.Starting, "Menyiapkan server lokal…");
        try
        {
            await CleanupAsync();
            if (!PortAvailable()) throw new InvalidOperationException(Conflict);
            using var manifest = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "manifest.json")));
            var expected = manifest.RootElement.GetProperty("runtimeVersion").GetString();
            if (string.IsNullOrWhiteSpace(expected)) throw new InvalidDataException("Manifest runtime version tidak valid.");
            var info = new ProcessStartInfo(Path.Combine(root, "runtime", "node.exe"))
            {
                WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true
            };
            // A packaged runtime must not inherit developer injection/module paths.
            info.Environment.Remove("NODE_OPTIONS");
            info.Environment.Remove("NODE_PATH");
            info.ArgumentList.Add(Path.Combine(root, "server", "kocokan-server.cjs"));
            info.ArgumentList.Add("--web-root");
            info.ArgumentList.Add(Path.Combine(root, "web"));
            info.ArgumentList.Add("--launcher-stdio");
            errorOutput = "";
            var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var process = new Process { StartInfo = info, EnableRaisingEvents = true };
            child = process;
            process.OutputDataReceived += (_, args) =>
            {
                if (args.Data == null) return;
                try
                {
                    using var data = JsonDocument.Parse(args.Data);
                    var value = data.RootElement;
                    if (value.GetProperty("type").GetString() == "ready" && value.GetProperty("version").GetString() == expected && value.GetProperty("origin").GetString() == Origin)
                        ready.TrySetResult();
                }
                catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException) { }
            };
            process.ErrorDataReceived += (_, args) => { if (args.Data != null) lock (process) errorOutput = (errorOutput + args.Data)[^Math.Min(2000, errorOutput.Length + args.Data.Length)..]; };
            job = new ChildJob();
            if (!process.Start()) throw new InvalidOperationException("Node runtime gagal dijalankan.");
            job.Assign(process);
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            while (true)
            {
                cancellation.ThrowIfCancellationRequested();
                if (process.HasExited)
                {
                    await process.WaitForExitAsync();
                    throw new InvalidOperationException(errorOutput.Contains("already in use") ? Conflict : "Server berhenti saat startup. " + errorOutput);
                }
                if (ready.Task.IsCompletedSuccessfully)
                {
                    try
                    {
                        using var response = await http.GetAsync(Origin + "/health", cancellation);
                        if (response.IsSuccessStatusCode)
                        {
                            using var health = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellation));
                            var value = health.RootElement;
                            if (value.GetProperty("ready").GetBoolean() && value.GetProperty("application").GetString() == "kocokan" && value.GetProperty("version").GetString() == expected && value.GetProperty("status").GetString() == "running" && !process.HasExited)
                            { Set(RuntimeState.Running, "Server lokal siap digunakan."); _ = WatchExitAsync(process); return; }
                        }
                    }
                    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException) { }
                }
                await Task.Delay(150, cancellation);
            }
        }
        catch (Exception ex)
        {
            await CleanupAsync();
            if (!stopping) Set(RuntimeState.Error, ex is OperationCanceledException ? "Startup timeout. Server belum siap; periksa paket lalu Retry." : ex.Message);
        }
    }
    private async Task WatchExitAsync(Process process)
    {
        await process.WaitForExitAsync();
        if (!stopping && ReferenceEquals(child, process) && State == RuntimeState.Running)
            Set(RuntimeState.Error, "Server berhenti tiba-tiba. Klik Retry untuk menjalankan kembali.");
    }
    public async Task StopAsync()
    {
        if (stopping) return;
        stopping = true;
        Set(RuntimeState.Stopping, "Menghentikan server…");
        starting?.Cancel();
        if (startTask != null) await startTask;
        await CleanupAsync();
        // Do not terminate an unrelated process which acquired the port meanwhile.
        if (!PortAvailable()) throw new InvalidOperationException("Runtime sendiri sudah berhenti, tetapi port 47882 masih digunakan proses lain.");
    }
    private async Task CleanupAsync()
    {
        var process = child;
        if (process == null) return;
        ForcedLastStop = false;
        try
        {
            if (!process.HasExited)
            {
                try { await process.StandardInput.WriteLineAsync("shutdown"); await process.StandardInput.FlushAsync(); process.StandardInput.Close(); }
                catch (Exception ex) when (ex is IOException or InvalidOperationException) { }
                try { await process.WaitForExitAsync().WaitAsync(stopTimeout); }
                catch (TimeoutException)
                {
                    ForcedLastStop = true;
                    if (!process.HasExited) process.Kill(entireProcessTree: true);
                    await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3));
                }
            }
        }
        catch (InvalidOperationException) { /* Start failed before a process existed. */ }
        finally { job?.Dispose(); job = null; child = null; process.Dispose(); }
    }
    public void Dispose()
    {
        starting?.Cancel();
        job?.Dispose();
        child?.Dispose();
        starting?.Dispose();
        http.Dispose();
    }
}
