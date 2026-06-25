// Widget configuration for Radarr
const widget = {
  api: "{url}/api/v3/{endpoint}?apikey={key}",
  mappings: {
    movie: {
      endpoint: "movie",
      map: (data) => {
        const movies = data.length;
        let downloaded = 0;
        let missing = 0;
        data.forEach((movie) => {
          if (movie.hasFile) downloaded++;
          else if (movie.monitored && movie.isAvailable) missing++;
        });
        return { movies, downloaded, missing };
      },
    },
    "queue/status": {
      endpoint: "queue/status",
      validate: ["totalCount"],
    },
    "queue/details": {
      endpoint: "queue/details",
      map: (data) =>
        data
          .map((entry) => ({
            title: entry.title || entry.movie?.title || "Unknown",
            timeLeft: entry.timeleft,
            progress: entry.size && entry.sizeleft
              ? Math.round((1 - entry.sizeleft / entry.size) * 100)
              : 0,
            status: entry.status,
          }))
          .slice(0, 5),
    },
  },
};

export default widget;
