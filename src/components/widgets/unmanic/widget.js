const widget = {
  api: "{url}/unmanic/api/v2/{endpoint}",
  mappings: {
    workers: {
      endpoint: "workers/status",
      map: (data) => ({
        total_workers: asJson(data).workers_status.length,
        active_workers: asJson(data).workers_status.filter((worker) => !worker.idle).length
      })
    },
    pending: {
      method: "POST",
      body: "{}",
      endpoint: "pending/tasks",
      validate: ["recordsTotal"]
    }
  }
};

export default widget;
