const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    statistics: {
      endpoint: "statistics/?format=json",
      validate: ["documents_total"]
    }
  }
};

export default widget;
