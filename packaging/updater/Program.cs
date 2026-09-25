namespace Kocokan.Updater;

internal static class Program
{
    [STAThread]
    private static async Task Main(string[] args) => await UpdaterApplication.RunAsync(args);
}
