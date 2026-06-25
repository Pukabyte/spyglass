const widget = {
  api: "{url}/v1/{endpoint}",
  mappings: {
    counters: {
      endpoint: "feeds/counters",
      map: (data) => ({
        read: Object.values(asJson(data).reads).reduce((acc, i) => acc + i, 0),
        unread: Object.values(asJson(data).unreads).reduce((acc, i) => acc + i, 0)
      })
    }
  }
};

export default widget;
