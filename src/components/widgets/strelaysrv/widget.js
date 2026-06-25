const widget = {
  api: "{url}/{endpoint}",
  mappings: {
    status: {
      endpoint: "status",
      validate: ["numActiveSessions", "numConnections", "bytesProxied"]
    }
  }
};

export default widget;
