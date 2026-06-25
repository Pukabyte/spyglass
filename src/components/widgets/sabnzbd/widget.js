const widget = {
  api: "{url}/api/?apikey={key}&output=json&mode={endpoint}",
  mappings: {
    queue: {
      endpoint: "queue",
      validate: ["queue"]
    }
  }
};

export default widget;
