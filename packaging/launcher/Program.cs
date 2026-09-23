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
        try { ApplicationConfiguration.Initialize(); Application.Run(new LauncherForm()); }
        finally { mutex.ReleaseMutex(); }
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int RegisterWindowMessage(string name);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr handle, int message, IntPtr wParam, IntPtr lParam);
}

internal sealed class LauncherForm : Form
{
    private readonly RuntimeController runtime = new(AppContext.BaseDirectory);
    private readonly Label status = new() { AutoSize = true, Text = "Starting", AccessibleName = "Server status" };
    private readonly Label message = new() { AutoSize = true, MaximumSize = new Size(490, 0) };
    private readonly Button launch = new() { Text = "Launch Kocokan", AutoSize = true, Enabled = false };
    private readonly Button retry = new() { Text = "Retry", AutoSize = true, Visible = false };
    private bool closing;
    private bool canClose;
    public LauncherForm()
    {
        Text = "Kocokan Launcher";
        ClientSize = new Size(540, 310);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        AutoScaleMode = AutoScaleMode.Dpi;
        var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(22), AutoScroll = true };
        layout.Controls.Add(new Label { Text = "KOCOKAN", AutoSize = true, Font = new Font(Font.FontFamily, 20, FontStyle.Bold) });
        layout.Controls.Add(new Label { Text = "Local Event Draw Server", AutoSize = true });
        layout.Controls.Add(status);
        layout.Controls.Add(new TextBox { Text = RuntimeController.Origin + "/", ReadOnly = true, Width = 480, AccessibleName = "Server URL" });
        layout.Controls.Add(new Label { Text = "Port: 47882 (read-only)", AutoSize = true });
        layout.Controls.Add(message);
        var buttons = new FlowLayoutPanel { AutoSize = true, WrapContents = false };
        var hide = new Button { Text = "Hide", AutoSize = true };
        var quit = new Button { Text = "Quit", AutoSize = true };
        buttons.Controls.AddRange([launch, hide, quit, retry]);
        layout.Controls.Add(buttons);
        layout.Controls.Add(new Label { Text = "Hide minimizes to taskbar. Reopen from taskbar or Kocokan.exe.", AutoSize = true });
        Controls.Add(layout);
        runtime.Changed += RefreshState;
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
