const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    system: {
      endpoint: "v1/status/system",
      validate: ["data"]
    },
    interface: {
      endpoint: "v1/status/interface",
      validate: ["data"]
    },
    systemv2: {
      endpoint: "v2/status/system",
      validate: ["data"]
    },
    interfacev2: {
      endpoint: "v2/status/interfaces?limit=0&offset=0",
      validate: ["data"]
    }
  }
};

export default widget;
