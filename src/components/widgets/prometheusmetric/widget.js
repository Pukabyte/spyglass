const widget = {
  api: "{url}/api/v1/{endpoint}",
  mappings: {
    query: {
      method: "GET",
      endpoint: "query",
      params: ["query"]
    }
  }
};

export default widget;
