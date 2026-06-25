const widget = {
  api: "{url}/rest/{endpoint}?u={user}&t={token}&s={salt}&v=1.16.1&c=homepage&f=json",
  mappings: {
    getNowPlaying: {
      endpoint: "getNowPlaying"
    }
  }
};

export default widget;
