// Widget configuration for Emby
// Emby uses the same API structure as Jellyfin
const widget = {
  api: "{url}/{endpoint}",
  headers: {
    "X-Emby-Token": "{key}",
  },
  mappings: {
    "Items/Counts": {
      endpoint: "Items/Counts",
      map: (data) => ({
        movies: data.MovieCount || 0,
        series: data.SeriesCount || 0,
        episodes: data.EpisodeCount || 0,
        songs: data.SongCount || 0,
      }),
    },
    Sessions: {
      endpoint: "Sessions",
      map: (data) => {
        const activeSessions = data.filter((s) => s.NowPlayingItem);
        return {
          streams: activeSessions.length,
          sessions: activeSessions.map((session) => ({
            userName: session.UserName || "Unknown",
            client: session.Client || session.DeviceName || "Unknown",
            deviceName: session.DeviceName || "",
            nowPlayingItem: session.NowPlayingItem?.Name || "Unknown",
            seriesName: session.NowPlayingItem?.SeriesName || null,
            type: session.NowPlayingItem?.Type || "Unknown",
            isPaused: session.PlayState?.IsPaused || false,
            positionTicks: session.PlayState?.PositionTicks || 0,
            runtimeTicks: session.NowPlayingItem?.RunTimeTicks || 0,
          })),
        };
      },
    },
  },
};

export default widget;
