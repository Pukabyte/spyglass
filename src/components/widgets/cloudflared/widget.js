const widget = {
  api: "https://api.cloudflare.com/client/v4/accounts/{accountid}/{endpoint}/{tunnelid}",
  mappings: {
    cfd_tunnel: {
      endpoint: "cfd_tunnel",
      validate: ["success", "result"]
    }
  }
};

export default widget;
