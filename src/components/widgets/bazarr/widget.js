const widget = {
  api: "{url}/api/{endpoint}?apikey={key}",
  mappings: {
    movies: {
      endpoint: "movies/wanted",
      map: (data) => ({
        total: asJson(data).total
      })
    },
    episodes: {
      endpoint: "episodes/wanted",
      map: (data) => ({
        total: asJson(data).total
      })
    }
  }
};

export default widget;
