// qBittorrent uses cookie-based auth (username/password login via /api/v2/auth/login)
// No API key; the boilerplate must handle session cookie authentication.
const widget = {
  api: "{url}/api/v2/{endpoint}",
  mappings: {
    "transfer/info": {
      endpoint: "transfer/info",
      // Returns: { dl_info_speed, up_info_speed, dl_info_data, up_info_data, ... }
    },
    "torrents/info": {
      endpoint: "torrents/info",
      // Returns: array of torrent objects
    },
  },
};

export default widget;
