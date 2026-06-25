const widget = {
  api: "{url}/{endpoint}",
  mappings: {
    data: {
      endpoint: "php/server/devices.php?action=getDevicesTotals"
    },
    datav2: {
      endpoint: "devices/totals"
    }
  }
};

export default widget;
