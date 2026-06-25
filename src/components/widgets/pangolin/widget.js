const widget = {
  api: "{url}/v1/{endpoint}",
  mappings: {
    sites: {
      endpoint: "org/{org}/sites"
    },
    resources: {
      endpoint: "org/{org}/resources"
    }
  }
};

export default widget;
