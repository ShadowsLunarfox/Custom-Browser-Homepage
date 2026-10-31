using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Windows.Forms;
using Windows.Media;

// Explicit test fixture only: an isolated, muted session. Never controls another app.
internal static class MediaFixture
{
    [ComImport, Guid("ddb0472d-c911-4a1f-86d9-dc3d71a95f5a"), InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
    private interface IControlsInterop
    {
        [return: MarshalAs(UnmanagedType.IInspectable)]
        object GetForWindow(IntPtr window, ref Guid iid);
    }

    [STAThread]
    private static void Main(string[] args)
    {
        try { Run(args); }
        catch (Exception error) { Console.Error.WriteLine(error); Environment.ExitCode = 1; }
    }
    private static void Run(string[] args)
    {
        using (var window = new Form())
        {
            window.ShowInTaskbar = false;
            var factory = (IControlsInterop)WindowsRuntimeMarshal.GetActivationFactory(typeof(SystemMediaTransportControls));
            var iid = new Guid("99fa3ff4-1742-42a6-902e-087d41f965ec");
            var controls = (SystemMediaTransportControls)factory.GetForWindow(window.Handle, ref iid);
            controls.IsEnabled = true;
            controls.IsPlayEnabled = true;
            controls.IsPauseEnabled = true;
            controls.PlaybackStatus = MediaPlaybackStatus.Playing;
            double position = 0;
            bool playing = true;
            var gate = new object();
            Action update = () => controls.UpdateTimelineProperties(new SystemMediaTransportControlsTimelineProperties {
                StartTime = TimeSpan.Zero, EndTime = TimeSpan.FromSeconds(120),
                MinSeekTime = TimeSpan.Zero, MaxSeekTime = TimeSpan.FromSeconds(120), Position = TimeSpan.FromSeconds(position)
            });
            controls.ButtonPressed += (sender, received) => {
                lock (gate) {
                    if (received.Button == SystemMediaTransportControlsButton.Play) playing = true;
                    if (received.Button == SystemMediaTransportControlsButton.Pause) playing = false;
                    controls.PlaybackStatus = playing ? MediaPlaybackStatus.Playing : MediaPlaybackStatus.Paused;
                    update();
                }
            };
            controls.PlaybackPositionChangeRequested += (sender, received) => { lock (gate) { position = received.RequestedPlaybackPosition.TotalSeconds; update(); } };
            controls.DisplayUpdater.Type = MediaPlaybackType.Music;
            controls.DisplayUpdater.MusicProperties.Title = "Lunar isolated media verification";
            controls.DisplayUpdater.MusicProperties.Artist = "Silent test fixture";
            controls.DisplayUpdater.Update();
            update();
            // This top-level HWND stays hidden. No file, audio device, or other player is used.
            int ticks = 0;
            using (var timer = new System.Windows.Forms.Timer()) {
                timer.Interval = 100;
                timer.Tick += (sender, received) => { lock (gate) { if (playing) position = Math.Min(120, position + .1); update(); } if (++ticks >= 600) Application.ExitThread(); };
                timer.Start();
                Application.Run();
            }
            controls.IsEnabled = false;
        }
    }
}
