const widget = {
  api: "{url}/api/{endpoint}",
  apiv5: "{url}/admin/api.php?{endpoint}&auth={key}",
  mappings: {
    "stats/summary": {
      endpoint: "stats/summary"
    },
    summaryRaw: {
      endpoint: "summaryRaw"
    }
  }
};

export default widget;
