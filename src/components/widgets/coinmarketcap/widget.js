const widget = {
  api: "https://pro-api.coinmarketcap.com/{endpoint}",
  mappings: {
    "v1/cryptocurrency/quotes/latest": {
      endpoint: "v1/cryptocurrency/quotes/latest",
      params: ["convert"],
      optionalParams: ["symbol", "slug"]
    }
  }
};

export default widget;
