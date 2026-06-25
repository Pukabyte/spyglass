const widget = {
  api: "{url}/api/application/{endpoint}",
  mappings: {
    nodes: {
      endpoint: "nodes?include=servers",
      validate: ["data"]
    }
  }
};

export default widget;
