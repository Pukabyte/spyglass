const widget = {
  api: "{url}/cgi-bin/{endpoint}",
  mappings: {
    status: { endpoint: "management/manaRequest.cgi?subfunc=sysinfo&sysinfo=detail" },
  },
};

export default widget;
