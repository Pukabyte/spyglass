const widget = {
  api: "{url}/api?cmd={endpoint}&apikey={key}",
  mappings: {
    issues: {
      endpoint: "getIndex"
    },
    series: {
      endpoint: "seriesjsonListing"
    },
    wanted: {
      endpoint: "getWanted"
    }
  }
};

export default widget;
