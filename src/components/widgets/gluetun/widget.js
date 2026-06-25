const widget = {
  api: "{url}/v1/{endpoint}",
  mappings: {
    ip: {
      endpoint: "publicip/ip",
      validate: ["public_ip", "country"]
    },
    port_forwarded: {
      endpoint: "openvpn/portforwarded",
      validate: ["port"]
    },
    port_forwarded_v2: {
      endpoint: "portforward",
      validate: ["port"]
    }
  }
};

export default widget;
