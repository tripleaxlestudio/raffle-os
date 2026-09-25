using System.Diagnostics;
using System.Security.Cryptography;

namespace Kocokan;

internal sealed class UpdateRuntimeBootstrap
{
    internal const string CapabilityEnvironmentVariable = "KOCOKAN_UPDATE_CAPABILITY";
    internal const string TokenEnvironmentVariable = "KOCOKAN_UPDATE_TOKEN";
    internal UpdateRuntimeCapability Capability { get; }
    internal string MutationToken { get; }

    internal UpdateRuntimeBootstrap(UpdateRuntimeCapability capability, string mutationToken)
    {
        Capability = capability;
        MutationToken = mutationToken;
    }

    internal static UpdateRuntimeBootstrap Create(InstalledModeDetector detector)
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return new UpdateRuntimeBootstrap(detector.Detect(), token);
    }

    internal void ApplyTo(ProcessStartInfo process)
    {
        // Override inherited values so a parent environment cannot promote a
        // portable launcher. These values exist only in the Node child.
        process.Environment.Remove(CapabilityEnvironmentVariable);
        process.Environment.Remove(TokenEnvironmentVariable);
        process.Environment[CapabilityEnvironmentVariable] = Capability == UpdateRuntimeCapability.Installed ? "installed" : "portable";
        process.Environment[TokenEnvironmentVariable] = MutationToken;
    }

    public override string ToString() => $"UpdateRuntimeBootstrap {{ Capability = {Capability} }}";
}
