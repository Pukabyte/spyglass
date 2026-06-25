const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    statisticsv1: {
      endpoint: "groups/statistics"
    },
    statisticsv2: {
      endpoint: "households/statistics"
    }
  }
};

export default widget;
