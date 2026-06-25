// Unraid does not have a standard public REST API.
// Community plugins (e.g. unraid-api) may expose endpoints under /api/.
const widget = {
  api: "{url}/{endpoint}",
  mappings: {
    system: {
      endpoint: "api/system",
      // Returns system info when unraid-api plugin is installed
    },
  },
};

export default widget;
