// import credentialedProxyHandler from "utils/proxy/handlers/credentialed";

const widget = {
  api: "{url}/{endpoint}",
  mappings: {
    status: {
      endpoint: "api/v1/endpoints/statuses"
    }
  }
};

export default widget;
