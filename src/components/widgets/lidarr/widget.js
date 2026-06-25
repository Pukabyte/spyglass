// Widget configuration for Lidarr
const widget = {
  api: "{url}/api/v1/{endpoint}?apikey={key}",
  mappings: {
    artist: {
      endpoint: "artist",
      map: (data) => data.length,
    },
    queue: {
      endpoint: "queue",
      validate: ["totalRecords"],
      map: (data) => ({
        total: data.totalRecords || 0,
        items: (data.records || []).slice(0, 5).map((entry) => ({
          title: entry.title || entry.album?.title || "Unknown",
          artist: entry.artist?.artistName || "",
          timeLeft: entry.timeleft,
          progress: entry.size && entry.sizeleft
            ? Math.round((1 - entry.sizeleft / entry.size) * 100)
            : 0,
          status: entry.status,
        })),
      }),
    },
    "wanted/missing": {
      endpoint: "wanted/missing",
      params: ["pageSize"],
      validate: ["totalRecords"],
    },
  },
};

export default widget;
