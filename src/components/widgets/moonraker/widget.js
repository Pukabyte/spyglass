const widget = {
  api: "{url}/printer/objects/query?{endpoint}",
  mappings: {
    print_stats: {
      endpoint: "print_stats"
    },
    display_status: {
      endpoint: "display_status"
    },
    webhooks: {
      endpoint: "webhooks"
    }
  }
};

export default widget;
