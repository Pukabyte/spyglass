const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    summary: {
      endpoint: "summary",
      validate: ["data"]
    },
    settings: {
      endpoint: "settings",
      validate: ["settings"]
    }
  }
};

export default widget;
