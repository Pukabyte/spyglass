const widget = {
  api: "{url}/api/{endpoint}?token={key}&utc=true",
  mappings: {
    stats: {
      endpoint: "dashboard/stats/get",
      validate: ["response", "status"],
      params: ["type"],
      map: (data) => asJson(data).response?.stats
    }
  }
};

export default widget;
