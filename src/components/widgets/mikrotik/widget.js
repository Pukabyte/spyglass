const widget = {
  api: "{url}/rest/{endpoint}",
  mappings: {
    system: {
      endpoint: "system/resource",
      validate: ["cpu-load", "free-memory", "total-memory", "uptime"]
    },
    leases: {
      endpoint: "ip/dhcp-server/lease?.proplist=address"
    }
  }
};

export default widget;
