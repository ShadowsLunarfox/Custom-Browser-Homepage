using System;
using System.Collections.Generic;
using System.Globalization;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Windows.ApplicationModel;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Storage.Streams;

// Native messaging only. No TCP listener, shell commands, browser injection, or autoplay.
internal static class Program
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1000000 };
    private static GlobalSystemMediaTransportControlsSessionManager Manager;
    private static GlobalSystemMediaTransportControlsSession CurrentSession;
    private static string CurrentId = "";
    private static volatile bool CurrentDirty = true;
    private static string ArtworkKey = "";
    private static string Artwork = "";

    [MTAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length == 1 && args[0] == "--probe")
            {
                Console.OutputEncoding = new UTF8Encoding(false);
                Console.WriteLine(Json.Serialize(Snapshot()));
                return 0;
            }
            Run();
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.GetType().Name + ": " + error.Message);
            return 1;
        }
    }

    private static void Run()
    {
        using (var input = Console.OpenStandardInput())
        using (var output = Console.OpenStandardOutput())
        {
            var header = new byte[4];
            while (ReadExactly(input, header, true))
            {
                int length = BitConverter.ToInt32(header, 0);
                if (length < 2 || length > 65536) throw new InvalidDataException("Invalid message length");
                var body = new byte[length];
                ReadExactly(input, body, false);
                object requestId = null;
                object response;
                try
                {
                    var request = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(body));
                    request.TryGetValue("id", out requestId);
                    string command = Text(request, "command");
                    string sessionId = Text(request, "sessionId");
                    if (command != "status") Command(command, sessionId, request);
                    response = new { id = requestId, ok = true, snapshot = Snapshot(Text(request, "artworkKey")) };
                }
                catch (CommandError error)
                {
                    response = new { id = requestId, ok = false, error = error.Code };
                }
                catch (Exception error)
                {
                    Console.Error.WriteLine(error.GetType().Name + ": " + error.Message);
                    response = new { id = requestId, ok = false, error = "windows_unavailable" };
                }
                var bytes = Encoding.UTF8.GetBytes(Json.Serialize(response));
                if (bytes.Length > 950000) throw new InvalidDataException("Response is too large");
                output.Write(BitConverter.GetBytes(bytes.Length), 0, 4);
                output.Write(bytes, 0, bytes.Length);
                output.Flush();
            }
        }
    }

    private static bool ReadExactly(Stream input, byte[] bytes, bool allowEnd)
    {
        int offset = 0;
        while (offset < bytes.Length)
        {
            int read = input.Read(bytes, offset, bytes.Length - offset);
            if (read == 0)
            {
                if (allowEnd && offset == 0) return false;
                throw new EndOfStreamException();
            }
            offset += read;
        }
        return true;
    }

    // Keep WinRT operations, their results, and cached sessions on the same MTA thread.
    // Inbox .NET task adapters can fetch results on a different COM apartment.
    private static T Complete<T>(IAsyncOperation<T> operation)
    {
        var clock = Stopwatch.StartNew();
        while (operation.Status == AsyncStatus.Started && clock.ElapsedMilliseconds < 5000) Thread.Sleep(5);
        if (operation.Status == AsyncStatus.Started) { operation.Cancel(); throw new TimeoutException(); }
        try { return operation.GetResults(); } finally { operation.Close(); }
    }

    private static GlobalSystemMediaTransportControlsSession Current()
    {
        if (Manager == null) {
            Manager = Complete(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
            Manager.CurrentSessionChanged += (sender, args) => { CurrentDirty = true; };
            Manager.SessionsChanged += (sender, args) => { CurrentDirty = true; };
        }
        if (CurrentDirty) {
            CurrentDirty = false;
            // Use the exact session Windows selects, including multiple sessions from
            // one app. Do not approximate it by app name or retain a manual selection.
            CurrentSession = Manager.GetCurrentSession();
            CurrentId = CurrentSession == null ? "" : Guid.NewGuid().ToString("N");
        }
        return CurrentSession;
    }

    private static void Command(string command, string sessionId, Dictionary<string, object> request)
    {
        if (!new[] { "play", "pause", "toggle", "seekTo", "seekBy", "next", "previous" }.Contains(command)) throw new CommandError("unsupported_command");
        var session = Current();
        if (session == null || sessionId != CurrentId) throw new CommandError("session_gone");
        var info = session.GetPlaybackInfo();
        var controls = info.Controls;
        bool ok;
        if (command == "play" && controls.IsPlayEnabled) ok = Complete(session.TryPlayAsync());
        else if (command == "pause" && controls.IsPauseEnabled) ok = Complete(session.TryPauseAsync());
        else if (command == "toggle" && ((info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing && controls.IsPauseEnabled) || (info.PlaybackStatus != GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing && controls.IsPlayEnabled))) ok = Complete(session.TryTogglePlayPauseAsync());
        else if (command == "next" && controls.IsNextEnabled) ok = Complete(session.TrySkipNextAsync());
        else if (command == "previous" && controls.IsPreviousEnabled) ok = Complete(session.TrySkipPreviousAsync());
        else if ((command == "seekTo" || command == "seekBy") && controls.IsPlaybackPositionEnabled)
        {
            var timeline = session.GetTimelineProperties();
            double seconds = Number(request, "seconds");
            if (command == "seekBy") seconds += Position(timeline, info);
            double duration = Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds);
            double minimum = Math.Max(0, (timeline.MinSeekTime - timeline.StartTime).TotalSeconds);
            double maximum = timeline.MaxSeekTime > timeline.StartTime ? (timeline.MaxSeekTime - timeline.StartTime).TotalSeconds : duration;
            if (maximum <= minimum || duration <= 0) throw new CommandError("seek_unavailable");
            seconds = Math.Max(minimum, Math.Min(Math.Min(duration, maximum), seconds));
            long ticks = timeline.StartTime.Ticks + TimeSpan.FromSeconds(seconds).Ticks;
            ok = Complete(session.TryChangePlaybackPositionAsync(ticks));
        }
        else throw new CommandError("control_unavailable");
        if (!ok) throw new CommandError("command_rejected");
    }

    private static object Snapshot(string knownArtworkKey = "")
    {
        var selected = Current();
        if (selected == null) return new { available = false };
        GlobalSystemMediaTransportControlsSessionMediaProperties properties = null;
        try { properties = Complete(selected.TryGetMediaPropertiesAsync()); }
        catch (Exception error) { Console.Error.WriteLine("Media metadata: " + error.GetType().Name); }
        var playback = selected.GetPlaybackInfo();
        var timeline = selected.GetTimelineProperties();
        var controls = playback.Controls;
        var title = properties == null ? "" : Limit(properties.Title);
        var artist = properties == null ? "" : Limit(properties.Artist);
        var artworkKey = CurrentId + "|" + title + "|" + artist;
        if (artworkKey != ArtworkKey)
        {
            ArtworkKey = artworkKey;
            Artwork = "";
            if (properties != null && properties.Thumbnail != null)
            {
                try
                {
                    using (var stream = Complete(properties.Thumbnail.OpenReadAsync()))
                    {
                        if (stream.Size > 0 && stream.Size <= 384 * 1024)
                        using (var reader = new DataReader(stream.GetInputStreamAt(0)))
                        {
                            Complete(reader.LoadAsync((uint)stream.Size));
                            var bytes = new byte[(int)stream.Size];
                            reader.ReadBytes(bytes);
                            var mime = stream.ContentType;
                            if (!new[] { "image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp" }.Contains(mime)) mime = "image/png";
                            Artwork = "data:" + mime + ";base64," + Convert.ToBase64String(bytes);
                        }
                    }
                }
                catch { Artwork = ""; }
            }
        }
        double duration = Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds);
        double minSeek = Math.Max(0, (timeline.MinSeekTime - timeline.StartTime).TotalSeconds);
        double maxSeek = timeline.MaxSeekTime > timeline.StartTime ? (timeline.MaxSeekTime - timeline.StartTime).TotalSeconds : duration;
        return new {
            available = true, sessionId = CurrentId, app = AppName(selected.SourceAppUserModelId), title = title, artist = artist, artwork = knownArtworkKey == ArtworkKey ? null : Artwork, artworkKey = ArtworkKey,
            playing = playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
            position = Position(timeline, playback), duration = duration, rate = playback.PlaybackRate ?? 1.0,
            canPlay = controls.IsPlayEnabled, canPause = controls.IsPauseEnabled,
            canSeek = controls.IsPlaybackPositionEnabled && duration > 0 && Math.Min(duration, maxSeek) > minSeek,
            canNext = controls.IsNextEnabled, canPrevious = controls.IsPreviousEnabled
        };
    }

    private static double Position(GlobalSystemMediaTransportControlsSessionTimelineProperties timeline, GlobalSystemMediaTransportControlsSessionPlaybackInfo info)
    {
        double position = Math.Max(0, (timeline.Position - timeline.StartTime).TotalSeconds);
        double elapsed = (DateTimeOffset.UtcNow - timeline.LastUpdatedTime).TotalSeconds;
        if (info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing && elapsed > 0 && elapsed < 86400) position += elapsed * (info.PlaybackRate ?? 1.0);
        return Math.Min(Math.Max(0, (timeline.EndTime - timeline.StartTime).TotalSeconds), position);
    }
    private static string AppName(string id) { try { return Limit(AppInfo.GetFromAppUserModelId(id).DisplayInfo.DisplayName); } catch { return Limit(id); } }
    private static string Limit(string text) { return string.IsNullOrEmpty(text) ? "" : text.Substring(0, Math.Min(1000, text.Length)); }
    private static string Text(Dictionary<string, object> request, string key) { object value; return request.TryGetValue(key, out value) && value is string ? (string)value : ""; }
    private static double Number(Dictionary<string, object> request, string key) { object value; double number; if (!request.TryGetValue(key, out value) || !double.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out number) || double.IsNaN(number) || double.IsInfinity(number) || Math.Abs(number) > 86400000) throw new CommandError("invalid_position"); return number; }
    private sealed class CommandError : Exception { public readonly string Code; public CommandError(string code) { Code = code; } }
}
