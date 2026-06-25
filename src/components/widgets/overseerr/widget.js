const widget = {
  api: "{url}/api/v1/{endpoint}",
  mappings: {
    "request/count": {
      endpoint: "request/count",
      validate: ["pending", "processing", "approved", "available"]
    }
  }
};

export default widget;
