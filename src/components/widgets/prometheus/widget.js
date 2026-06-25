const widget = {
  api: "{url}/api/v1/{endpoint}",
  mappings: {
    targets: {
      endpoint: "targets?state=active",
      validate: ["data"]
    }
  }
};

export default widget;
