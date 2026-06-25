const widget = {
  api: "{url}/api/{endpoint}?apikey={key}",
  mappings: {
    printer_stats: {
      endpoint: "printer"
    },
    job_stats: {
      endpoint: "job"
    }
  }
};

export default widget;
