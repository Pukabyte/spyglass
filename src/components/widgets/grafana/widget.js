const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    alerts: {
      endpoint: "alerts"
    },
    alertmanager: {
      endpoint: "alertmanager/alertmanager/api/v2/alerts"
    },
    grafana: {
      endpoint: "alertmanager/grafana/api/v2/alerts"
    },
    stats: {
      endpoint: "admin/stats",
      validate: ["dashboards"]
    }
  }
};

export default widget;
