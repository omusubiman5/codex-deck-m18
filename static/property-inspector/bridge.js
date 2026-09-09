// Uses the existing inspector socket; no additional server or registration.
window.attachBridgeControls = (socket, actionInfo) => {
  const action = JSON.parse(actionInfo);
  const section = document.createElement("section");
  section.hidden = true;
  section.style.cssText = "margin-top:20px;padding-top:14px;border-top:1px solid #555";
  const title = document.createElement("strong");
  title.textContent = "Codex 接続";
  const status = document.createElement("p");
  status.style.cssText = "margin:10px 0;line-height:1.5";
  status.setAttribute("role", "status");
  const button = document.createElement("button");
  button.textContent = "接続・復旧";
  button.style.cssText = "padding:7px 16px;cursor:pointer";
  section.append(title, status, button);
  document.body.append(section);
  const send = (command) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({
      event: "sendToPlugin", action: action.action, context: action.context,
      payload: { type: "vsd-bridge", command }
    }));
  };
  button.addEventListener("click", () => { button.disabled = true; send("recover"); });
  socket.addEventListener("open", () => send("status"));
  socket.addEventListener("message", (message) => {
    const event = JSON.parse(message.data);
    if (event.event !== "sendToPropertyInspector" || event.payload?.type !== "vsd-bridge") return;
    section.hidden = false;
    status.textContent = event.payload.detail;
    button.disabled = event.payload.state === "connecting";
  });
  const timer = setInterval(() => send("status"), 2000);
  socket.addEventListener("close", () => {
    clearInterval(timer);
    status.textContent = "プラグインとの接続が切れました。";
    button.disabled = true;
  });
  window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
};
