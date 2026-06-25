const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    status: {
      endpoint: "statusServer",
      map: { ngEndpoint: "status_server" }
    }
  }
};

export default widget;
