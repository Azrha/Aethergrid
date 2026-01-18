const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("aethergrid", {
  version: "0.1.0",
});
