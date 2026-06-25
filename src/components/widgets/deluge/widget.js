// Deluge uses JSON-RPC. All requests POST to /json.
const widget = {
  api: "{url}/json",
  mappings: {
    rpc: {
      endpoint: "json",
      // JSON-RPC: POST { method: "web.update_ui", params: [fields, {}] }
    },
  },
};

export default widget;
