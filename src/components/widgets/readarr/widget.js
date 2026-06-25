const widget = {
  api: "{url}/api/v1/{endpoint}?apikey={key}",
  mappings: {
    book: {
      endpoint: "book",
      map: (data) => ({
        have: jsonArrayFilter(data, (item) => item?.statistics?.bookFileCount > 0).length
      })
    },
    "queue/status": {
      endpoint: "queue/status"
    },
    "wanted/missing": {
      endpoint: "wanted/missing"
    },
    calendar: {
      endpoint: "calendar",
      params: ["start", "end", "unmonitored", "includeAuthor"]
    }
  }
};

export default widget;
