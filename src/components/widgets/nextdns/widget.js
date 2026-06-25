const widget = {
  api: "https://api.nextdns.io/profiles/{profile}/{endpoint}",
  mappings: {
    "analytics/status": {
      endpoint: "analytics/status",
      validate: ["data"]
    }
  }
};

export default widget;
