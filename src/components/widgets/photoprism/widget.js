const widget = {
  api: "{url}/api/v1/{endpoint}",
  mappings: {
    stats: {
      endpoint: "config",
      // Returns: { count: { photos, videos, albums, ... }, version, ... }
    },
    photos: {
      endpoint: "photos",
      // Returns: array of photo objects
    },
  },
};

export default widget;
