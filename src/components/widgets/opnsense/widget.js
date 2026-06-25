const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    activity: {
      endpoint: "diagnostics/activity/getActivity",
      validate: ["headers"]
    },
    interface: {
      endpoint: "diagnostics/traffic/interface",
      validate: ["interfaces"]
    }
  }
};

export default widget;
