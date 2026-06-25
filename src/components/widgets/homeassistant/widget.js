const widget = {
  api: "{url}/api/{endpoint}",
  authType: "bearer",
  mappings: {
    states: {
      endpoint: "states",
      // Returns: array of state objects { entity_id, state, attributes, ... }
    },
    config: {
      endpoint: "config",
      // Returns: { location_name, version, components, ... }
    },
  },
};

export default widget;
