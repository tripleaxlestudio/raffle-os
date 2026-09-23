namespace Kocokan;

// Presentation only. Runtime state and all action handlers remain in Program.cs.
internal sealed partial class LauncherForm
{
    private static readonly Color Ink = Color.FromArgb(36, 33, 43);
    private static readonly Color Muted = Color.FromArgb(98, 92, 107);
    private static readonly Color Surface = Color.FromArgb(248, 247, 250);
    private static readonly Color Purple = Color.FromArgb(109, 58, 219);
    private readonly Label status = new() { AutoSize = true, Text = "Starting", AccessibleName = "Server status" };
    private readonly Label message = new() { AutoSize = true, Text = "Menyiapkan server lokal…", AccessibleName = "Server message", Margin = Padding.Empty };
    private readonly Button launch = new() { Text = "Launch Kocokan", Enabled = false };
    private readonly Button retry = new() { Text = "Retry", Visible = false };
    private readonly Button hide = new() { Text = "Hide" };
    private readonly Button quit = new() { Text = "Quit" };

    private void InitializeLayout()
    {
        SuspendLayout();
        Text = "Kocokan";
        Font = new Font("Segoe UI", 10F);
        ForeColor = Ink;
        BackColor = Color.White;
        AutoScaleDimensions = new SizeF(96F, 96F);
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(468, 426);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ShowIcon = false; // No approved launcher .ico asset is available yet.

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill, Padding = new Padding(24), Margin = Padding.Empty,
            ColumnCount = 1, RowCount = 12, BackColor = Color.White
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        foreach (var height in new[] { 56, 16, 30, 44, 22, 38, 30, 12, 46, 10, 34, 40 })
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, height));

        var header = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 2, Margin = Padding.Empty };
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 52));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 16));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        header.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));
        header.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        var monogram = new Label
        {
            Text = "K", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Purple, ForeColor = Color.White, Font = new Font(Font.FontFamily, 24F, FontStyle.Bold),
            Margin = new Padding(0, 0, 0, 4), AccessibleName = "Kocokan monogram"
        };
        header.Controls.Add(monogram, 0, 0);
        header.SetRowSpan(monogram, 2);
        header.Controls.Add(new Label { Text = "KOCOKAN", AutoSize = true, Font = new Font(Font.FontFamily, 17F, FontStyle.Bold), Margin = Padding.Empty }, 2, 0);
        header.Controls.Add(new Label { Text = "Local Event Draw Server", AutoSize = true, ForeColor = Muted, Margin = new Padding(0, 3, 0, 0) }, 2, 1);
        layout.Controls.Add(header, 0, 0);

        status.Font = new Font(Font, FontStyle.Bold);
        status.Padding = new Padding(10, 4, 10, 4);
        status.Margin = Padding.Empty;
        layout.Controls.Add(status, 0, 2);

        // Normal messages fit two lines. Unexpected diagnostics remain readable
        // through scrolling instead of stretching the fixed-size window.
        var messageArea = new Panel { Dock = DockStyle.Fill, AutoScroll = true, Margin = new Padding(0, 6, 0, 0) };
        message.ForeColor = Muted;
        messageArea.Controls.Add(message);
        messageArea.SizeChanged += (_, _) => message.MaximumSize = new Size(Math.Max(1, messageArea.ClientSize.Width - SystemInformation.VerticalScrollBarWidth), 0);
        layout.Controls.Add(messageArea, 0, 3);
        layout.Controls.Add(new Label { Text = "Server URL", AutoSize = true, ForeColor = Muted, Margin = Padding.Empty }, 0, 4);

        var urlSurface = new Panel { Dock = DockStyle.Fill, BackColor = Surface, Padding = new Padding(12, 8, 12, 6), Margin = Padding.Empty };
        urlSurface.Controls.Add(new TextBox
        {
            Text = RuntimeController.Origin + "/", ReadOnly = true, BorderStyle = BorderStyle.None,
            Dock = DockStyle.Top, BackColor = Surface, ForeColor = Ink,
            Font = new Font("Segoe UI", 11F), AccessibleName = "Server URL (read-only)", TabIndex = 0
        });
        layout.Controls.Add(urlSurface, 0, 5);
        layout.Controls.Add(new Label { Text = "Port   47882", AutoSize = true, ForeColor = Muted, Margin = new Padding(0, 7, 0, 0), AccessibleName = "Port 47882 (read-only)" }, 0, 6);

        StyleButton(launch, Purple, Color.White, false);
        launch.Font = new Font(Font.FontFamily, 11F, FontStyle.Bold);
        launch.Dock = DockStyle.Fill;
        launch.TabIndex = 1;
        launch.EnabledChanged += (_, _) =>
        {
            launch.BackColor = launch.Enabled ? Purple : Color.FromArgb(229, 224, 232);
            launch.FlatAppearance.BorderColor = launch.BackColor;
        };
        launch.BackColor = Color.FromArgb(229, 224, 232);
        layout.Controls.Add(launch, 0, 8);

        var actions = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 5, RowCount = 1, Margin = Padding.Empty };
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 90));
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 10));
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 90));
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        actions.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 80));
        StyleButton(hide, Color.White, Ink, true);
        StyleButton(retry, Color.White, Purple, true);
        StyleButton(quit, Color.White, Color.FromArgb(150, 43, 61), false);
        hide.TabIndex = 2;
        retry.TabIndex = 3;
        quit.TabIndex = 4;
        actions.Controls.Add(hide, 0, 0);
        actions.Controls.Add(retry, 2, 0);
        actions.Controls.Add(quit, 4, 0);
        layout.Controls.Add(actions, 0, 10);
        layout.Controls.Add(new Label
        {
            Text = "Kocokan Pilot  ·  Hide minimizes to taskbar", AutoSize = true,
            Font = new Font(Font.FontFamily, 9F), ForeColor = Muted, Margin = new Padding(0, 16, 0, 0)
        }, 0, 11);
        Controls.Add(layout);
        UpdateStatusAppearance(RuntimeState.Starting);
        ResumeLayout(true);
    }

    private static void StyleButton(Button button, Color background, Color foreground, bool border)
    {
        button.Dock = DockStyle.Fill;
        button.Margin = Padding.Empty;
        button.FlatStyle = FlatStyle.Flat;
        button.UseVisualStyleBackColor = false;
        button.BackColor = background;
        button.ForeColor = foreground;
        button.FlatAppearance.BorderSize = border ? 1 : 0;
        button.FlatAppearance.BorderColor = Color.FromArgb(211, 205, 216);
        button.FlatAppearance.MouseOverBackColor = background == Purple ? Color.FromArgb(91, 45, 189) : Surface;
        button.FlatAppearance.MouseDownBackColor = background == Purple ? Color.FromArgb(80, 38, 170) : Color.FromArgb(237, 227, 255);
    }

    private void UpdateStatusAppearance(RuntimeState state)
    {
        hide.Enabled = state != RuntimeState.Stopping;
        quit.Enabled = state != RuntimeState.Stopping;
        (status.BackColor, status.ForeColor) = state switch
        {
            RuntimeState.Running => (Color.FromArgb(225, 243, 232), Color.FromArgb(23, 103, 70)),
            RuntimeState.Error => (Color.FromArgb(252, 229, 229), Color.FromArgb(166, 47, 63)),
            RuntimeState.Starting => (Color.FromArgb(240, 234, 254), Color.FromArgb(80, 54, 141)),
            _ => (Color.FromArgb(238, 234, 227), Muted)
        };
        message.ForeColor = state == RuntimeState.Error ? Color.FromArgb(166, 47, 63) : Muted;
    }
}
