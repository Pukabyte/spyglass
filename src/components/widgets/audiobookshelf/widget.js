const widget = {
  api: "{url}/api/{endpoint}",
  authType: "bearer",
  mappings: {
    libraries: {
      endpoint: "libraries"
    },
    "me/listening-stats": {
      endpoint: "me/listening-stats"
    }
  }
};

export default widget;
