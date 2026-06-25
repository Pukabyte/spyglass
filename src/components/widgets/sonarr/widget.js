// Widget configuration for Sonarr
const widget = {
  api: "{url}/api/v3/{endpoint}?apikey={key}",
  mappings: {
    series: {
      endpoint: "series",
      map: (data) => data.length,
    },
    queue: {
      endpoint: "queue",
      validate: ["totalRecords"],
    },
    "wanted/missing": {
      endpoint: "wanted/missing",
      params: ["pageSize"],
      validate: ["totalRecords"],
    },
    "queue/details": {
      endpoint: "queue/details",
      map: (data) =>
        data
          .map((entry) => ({
            title: entry.title || entry.episode?.title || "Unknown",
            series: entry.series?.title || "",
            timeLeft: entry.timeleft,
            progress: entry.size && entry.sizeleft
              ? Math.round((1 - entry.sizeleft / entry.size) * 100)
              : 0,
            status: entry.status,
          }))
          .slice(0, 5),
    },
    calendar: {
      endpoint: "calendar",
      params: ["start", "end", "unmonitored", "includeSeries", "includeEpisodeFile", "includeEpisodeImages"],
    },
  },
};

export default widget;
