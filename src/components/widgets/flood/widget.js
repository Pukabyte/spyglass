const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    torrents: {
      endpoint: "torrents",
      // Returns: { torrents: { [hash]: { name, status, downRate, upRate, ... } } }
    },
  },
};

export default widget;
