const widget = {
  api: "{url}/etapi/{endpoint}",
  mappings: {
    metrics: {
      endpoint: "metrics?format=json",
      validate: ["version", "database"]
    }
  }
};

export default widget;
