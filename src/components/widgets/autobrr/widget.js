const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    stats: {
      endpoint: "release/stats",
      validate: ["push_approved_count", "push_rejected_count"]
    },
    filters: {
      endpoint: "filters"
    },
    indexers: {
      endpoint: "release/indexers"
    }
  }
};

export default widget;
