const widget = {
  api: "{url}/api/v1/{endpoint}",
  mappings: {
    items: {
      endpoint: "items",
      // Returns: { items: [...], total: N }
    },
    locations: {
      endpoint: "locations",
      // Returns: array of location objects
    },
    labels: {
      endpoint: "labels",
      // Returns: array of label objects
    },
  },
};

export default widget;
