// Transmission uses JSON-RPC, not REST. All requests POST to the same endpoint.
// Requires X-Transmission-Session-Id header (obtained from a 409 response).
const widget = {
  api: "{url}/transmission/rpc",
  mappings: {
    rpc: {
      endpoint: "transmission/rpc",
      // JSON-RPC: POST { method: "torrent-get", arguments: { fields: [...] } }
    },
  },
};

export default widget;
