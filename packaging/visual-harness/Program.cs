using System.Drawing.Imaging;
using System.Reflection;

namespace Kocokan;

// Offline presentation QA: startup handler detached only in this test process.
internal static class VisualReview
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--live")
        {
            CaptureLive(args[1]);
            return;
        }
        if (args.Length != 1) throw new ArgumentException("Usage: visual-harness <output-directory>");
        Directory.CreateDirectory(args[0]);
        ApplicationConfiguration.Initialize();
        foreach (var scale in new[] { 1F, 1.25F, 1.5F })
        foreach (var state in Enum.GetValues<RuntimeState>())
        {
            using var form = new LauncherForm();
            var runtime = Field<RuntimeController>(form, "runtime");
            try
            {
                // Render real controls offscreen without running Shown's server
                // startup. Production code contains no fixture/preview switch.
                var events = (System.ComponentModel.EventHandlerList)typeof(System.ComponentModel.Component)
                    .GetProperty("Events", PrivateInstance)!.GetValue(form)!;
                var shownKey = typeof(Form).GetFields(BindingFlags.Static | BindingFlags.NonPublic)
                    .Single(field => field.Name.Contains("shown", StringComparison.OrdinalIgnoreCase)).GetValue(null)!;
                var shownHandler = events[shownKey];
                if (shownHandler == null) throw new InvalidOperationException("Startup event not found");
                events.RemoveHandler(shownKey, shownHandler);
                form.StartPosition = FormStartPosition.Manual;
                form.Location = new Point(-32000, -32000);
                form.ShowInTaskbar = false;
                form.Show();
                var message = state switch
                {
                    RuntimeState.Starting => "Menyiapkan server lokal…",
                    RuntimeState.Running => "Server lokal siap digunakan.",
                    RuntimeState.Error => RuntimeController.Conflict,
                    _ => "Menghentikan server…"
                };
                typeof(RuntimeController).GetMethod("Set", PrivateInstance)!.Invoke(runtime, [state, message]);
                if (Field<Button>(form, "launch").Enabled != (state == RuntimeState.Running))
                    throw new InvalidOperationException("Launch state mismatch");
                if (Field<Label>(form, "status").Text != state.ToString())
                    throw new InvalidOperationException("Status text mismatch");
                if (Field<Button>(form, "retry").Visible != (state == RuntimeState.Error))
                    throw new InvalidOperationException("Retry state mismatch");
                if (Field<Button>(form, "hide").Enabled != (state != RuntimeState.Stopping) ||
                    Field<Button>(form, "quit").Enabled != (state != RuntimeState.Stopping))
                    throw new InvalidOperationException("Stopping control mismatch");

                // Explicit layout/font scale simulation; does not change Windows
                // display settings or claim physical-monitor DPI acceptance.
                form.AutoScaleMode = AutoScaleMode.None;
                var controls = Descendants(form).Prepend(form).ToArray();
                var fonts = controls.Select(control => control.Font).ToArray();
                form.Scale(new SizeF(scale, scale));
                for (var i = 0; i < controls.Length; i++)
                    controls[i].Font = new Font(fonts[i].FontFamily, fonts[i].Size * scale, fonts[i].Style);
                form.PerformLayout();
                foreach (var control in controls) control.CreateControl();
                form.PerformLayout();
                foreach (var label in controls.OfType<Label>())
                {
                    var size = label.GetPreferredSize(label.MaximumSize);
                    if (label.Width < size.Width || label.Height < size.Height)
                        throw new InvalidOperationException($"Clipped label at {scale}: {label.Text} actual={label.Size} preferred={size} dpi={form.DeviceDpi}");
                }
                foreach (var button in controls.OfType<Button>())
                {
                    var text = TextRenderer.MeasureText(button.Text, button.Font);
                    if (text.Width > button.Width || text.Height > button.Height)
                        throw new InvalidOperationException($"Clipped button at {scale}: {button.Text}");
                }
                foreach (var control in controls.Where(control => control != form && control.Visible))
                {
                    if (control.Parent == Field<Label>(form, "message").Parent) continue;
                    if (!control.Parent!.ClientRectangle.Contains(control.Bounds))
                        throw new InvalidOperationException($"Control outside parent at {scale}: {control.Text}");
                }
                var url = controls.OfType<TextBox>().Single();
                if (!url.ReadOnly || TextRenderer.MeasureText(url.Text, url.Font).Width > url.ClientSize.Width)
                    throw new InvalidOperationException("URL must fit and stay read-only");
                using var bitmap = new Bitmap(form.Width, form.Height);
                form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                var file = $"launcher-{state.ToString().ToLowerInvariant()}-{scale * 100:0}.png";
                bitmap.Save(Path.Combine(args[0], file), ImageFormat.Png);
                Console.WriteLine($"PASS: {state}, {scale * 100:0}% layout/font simulation, launch gating, text fit; {file}");
                if (state == RuntimeState.Error)
                {
                    var diagnostic = "Server berhenti saat startup. " + string.Join(" ", Enumerable.Repeat("Diagnostic detail retained for review.", 50));
                    typeof(RuntimeController).GetMethod("Set", PrivateInstance)!.Invoke(runtime, [state, diagnostic]);
                    form.PerformLayout();
                    var text = Field<Label>(form, "message");
                    var panel = (Panel)text.Parent!;
                    if (text.Text != diagnostic || !panel.VerticalScroll.Visible || !Field<Button>(form, "retry").Visible)
                        throw new InvalidOperationException("Long diagnostics must scroll without hiding Retry");
                    using var longBitmap = new Bitmap(form.Width, form.Height);
                    form.DrawToBitmap(longBitmap, new Rectangle(Point.Empty, form.Size));
                    longBitmap.Save(Path.Combine(args[0], $"launcher-error-long-{scale * 100:0}.png"), ImageFormat.Png);
                    Console.WriteLine($"PASS: long diagnostic scroll and Retry at {scale * 100:0}%");
                }
            }
            finally { runtime.Dispose(); }
        }
    }

    // Run this QA executable from the review package so AppContext.BaseDirectory
    // resolves its unchanged bundled runtime. No synthetic state in this mode.
    private static void CaptureLive(string output)
    {
        if (!File.Exists(Path.Combine(AppContext.BaseDirectory, "manifest.json")) || !RuntimeController.PortAvailable())
            throw new InvalidOperationException("Live capture needs the review package and free port 47882");
        ApplicationConfiguration.Initialize();
        using var form = new LauncherForm();
        form.StartPosition = FormStartPosition.Manual;
        form.Location = new Point(-32000, -32000);
        form.ShowInTaskbar = false;
        var runtime = Field<RuntimeController>(form, "runtime");
        using var timer = new System.Windows.Forms.Timer { Interval = 100 };
        var deadline = DateTime.UtcNow.AddSeconds(30);
        timer.Tick += async (_, _) =>
        {
            if (runtime.State == RuntimeState.Starting && DateTime.UtcNow < deadline) return;
            timer.Stop();
            try
            {
                if (runtime.State != RuntimeState.Running) throw new InvalidOperationException(runtime.Message);
                using var bitmap = new Bitmap(form.Width, form.Height);
                form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                bitmap.Save(output, ImageFormat.Png);
                Console.WriteLine($"PASS: real Running form, bundled child {runtime.ChildId}, {form.DeviceDpi} DPI; {output}");
            }
            catch (Exception ex) { Console.Error.WriteLine(ex.Message); Environment.ExitCode = 1; }
            finally
            {
                await runtime.StopAsync();
                form.Dispose();
                Application.ExitThread();
            }
        };
        timer.Start();
        Application.Run(form);
        runtime.Dispose();
    }

    private static T Field<T>(LauncherForm form, string name) where T : class =>
        (T)typeof(LauncherForm).GetField(name, PrivateInstance)!.GetValue(form)!;

    private static IEnumerable<Control> Descendants(Control parent)
    {
        foreach (Control child in parent.Controls)
        {
            yield return child;
            foreach (var descendant in Descendants(child)) yield return descendant;
        }
    }
}
