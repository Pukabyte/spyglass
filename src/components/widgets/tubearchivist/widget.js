const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    downloads: {
      endpoint: "stats/download"
    },
    videos: {
      endpoint: "stats/video",
      validate: ["doc_count"]
    },
    channels: {
      endpoint: "stats/channel",
      validate: ["doc_count"]
    },
    playlists: {
      endpoint: "stats/playlist",
      validate: ["doc_count"]
    }
  }
};

export default widget;
