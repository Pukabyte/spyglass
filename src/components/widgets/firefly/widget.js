const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    summary: {
      endpoint: "v1/summary/basic",
      params: ["start", "end"]
    },
    budgets: {
      endpoint: "v1/available-budgets",
      params: ["start", "end"]
    }
  }
};

export default widget;
