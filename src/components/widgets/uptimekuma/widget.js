const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    "status-page/heartbeat": {
      endpoint: "status-page/heartbeat/{slug}"
    }
  }
};

export default widget;
