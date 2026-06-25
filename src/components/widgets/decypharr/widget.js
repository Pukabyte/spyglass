const widget = {
  api: "{url}/api/{endpoint}",
  authType: "bearer",
  mappings: {
    arrs: { endpoint: "arrs" },
    torrents: { endpoint: "torrents" },
    "repair/jobs": { endpoint: "repair/jobs" },
  },
};

export default widget;
