const widget = {
  api: `{url}/api/v0/{endpoint}`,
  mappings: {
    application: {
      endpoint: "application"
    },
    downloads: {
      endpoint: "transfers/downloads"
    },
    uploads: {
      endpoint: "transfers/uploads"
    }
  }
};

export default widget;
