const widget = {
  api: "{url}/api/v1/{key}/{endpoint}",
  mappings: {
    stats: {
      endpoint: "?cmd=shows.stats",
      validate: ["data"]
    },
    future: {
      endpoint: "?cmd=future",
      validate: ["data"]
    }
  }
};

export default widget;
