const widget = {
  api: "{url}/{endpoint}",
  mappings: {
    getViewsByLibraryType: {
      endpoint: "stats/getViewsByLibraryType",
      params: ["days"]
    }
  }
};

export default widget;
