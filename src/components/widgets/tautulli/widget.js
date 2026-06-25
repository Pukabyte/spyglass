const widget = {
  api: "{url}/api/v2?apikey={key}&cmd={endpoint}",
  mappings: {
    get_activity: {
      endpoint: "get_activity"
    },
    get_libraries: {
      endpoint: "get_libraries"
    }
  }
};

export default widget;
