const widget = {
  api: "{url}/api/v4/{endpoint}",
  mappings: {
    counts: {
      endpoint: "users/{user_id}/associations_count"
    }
  }
};

export default widget;
