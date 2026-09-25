using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Kocokan;

internal static class Program
{
    internal const string InstanceName = @"Local\Kocokan.Pilot.47882";
    internal static readonly int ActivateMessage = RegisterWindowMessage("Kocokan.Pilot.Activate.47882");
    [STAThread]
    private static void Main()
    {
        using var mutex = new Mutex(true, InstanceName, out var created);
        if (!created) { PostMessage(new IntPtr(0xffff), ActivateMessage, IntPtr.Zero, IntPtr.Zero); return; }
        DiagnosticLog.Write("launcher-start");
        try { ApplicationConfiguration.Initialize(); Application.Run(new LauncherForm()); }
        finally { DiagnosticLog.Write("launcher-exit"); mutex.ReleaseMutex(); }
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int RegisterWindowMessage(string name);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr handle, int message, IntPtr wParam, IntPtr lParam);
}

internal sealed partial class LauncherForm : Form
{
    private readonly RuntimeController runtime = new(AppContext.BaseDirectory);
    private bool closing;
    private bool canClose;
    public LauncherForm()
    {
        InitializeLayout();
        runtime.Changed += () => DiagnosticLog.Write("runtime-state=" + runtime.State);
        runtime.Changed += RefreshState;
        runtime.InstallExitReady += () =>
        {
            if (IsDisposed || !IsHandleCreated) return;
            BeginInvoke(() => { canClose = true; Close(); });
        };
        Shown += async (_, _) => await runtime.StartAsync();
        retry.Click += async (_, _) => await runtime.StartAsync();
        hide.Click += (_, _) => WindowState = FormWindowState.Minimized;
        quit.Click += (_, _) => Close();
        launch.Click += (_, _) =>
        {
            if (runtime.State != RuntimeState.Running) return;
            try { Process.Start(new ProcessStartInfo(RuntimeController.Origin + "/") { UseShellExecute = true }); }
            catch (Exception ex) { MessageBox.Show(this, "Browser tidak dapat dibuka. Salin URL di launcher.\n" + ex.Message, "Browser", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        };
        FormClosing += OnClosing;
        FormClosed += (_, _) => runtime.Dispose();
    }
    private void RefreshState()
    {
        if (IsDisposed || !IsHandleCreated) return;
        if (InvokeRequired) { BeginInvoke(RefreshState); return; }
        status.Text = runtime.State.ToString();
        message.Text = runtime.Message;
        launch.Enabled = runtime.State == RuntimeState.Running;
        retry.Visible = runtime.State == RuntimeState.Error && !closing;
        UpdateStatusAppearance(runtime.State);
    }
    private async void OnClosing(object? sender, FormClosingEventArgs args)
    {
        if (canClose) return;
        args.Cancel = true;
        if (closing) return;
        if (MessageBox.Show(this, "Quit akan menghentikan server Kocokan. Lanjutkan?", "Quit Kocokan", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
        closing = true;
        try { await runtime.StopAsync(); }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "Shutdown", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        canClose = true;
        Close();
    }
    protected override void WndProc(ref Message message)
    {
        if (message.Msg == Program.ActivateMessage) { Show(); WindowState = FormWindowState.Normal; Activate(); }
        base.WndProc(ref message);
    }
}
