const widget = {
  api: "{url}/api_jsonrpc.php",
  mappings: {
    trigger: {
      endpoint: "trigger.get",
      params: {
        output: ["triggerid", "description", "priority"],
        filter: {
          value: 1
        },
        sortfield: "priority",
        sortorder: "DESC",
        monitored: "true"
      }
    }
  }
};

export default widget;
