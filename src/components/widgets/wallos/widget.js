const widget = {
  api: "{url}/api/{endpoint}?api_key={key}",
  mappings: {
    get_monthly_cost: {
      endpoint: "subscriptions/get_monthly_cost.php",
      validate: ["localized_monthly_cost", "currency_symbol"],
      params: ["month", "year"]
    },
    get_subscriptions: {
      endpoint: "subscriptions/get_subscriptions.php",
      validate: ["subscriptions"],
      params: ["state", "sort"]
    }
  }
};

export default widget;
