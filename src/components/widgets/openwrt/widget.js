const widget = {
  api: "{url}/cgi-bin/luci/rpc/{endpoint}",
  mappings: {
    sys: {
      endpoint: "sys",
    },
    uci: {
      endpoint: "uci",
    },
  },
};

export default widget;
