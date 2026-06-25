const widget = {
  api: "{url}/api?mode={endpoint}&apikey={key}&output=json",
  mappings: {
    queue: { endpoint: "queue" },
    history: { endpoint: "history" },
  },
};

export default widget;
