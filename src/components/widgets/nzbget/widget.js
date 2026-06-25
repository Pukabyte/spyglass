const widget = {
  api: "{url}/jsonrpc",
  allowedEndpoints: /status/,

  mappings: {
    status: {
      endpoint: "status"
    }
  }
};

export default widget;
