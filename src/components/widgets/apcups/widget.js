const widget = {
  api: "{url}/api/{endpoint}",
  mappings: {
    status: {
      endpoint: "status",
      // Returns UPS status: { STATUS, LINEV, LOADPCT, BCHARGE, TIMELEFT, ... }
    },
  },
};

export default widget;
