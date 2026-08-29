import assert from "node:assert/strict";
import test from "node:test";
import { M18AdapterClient } from "../src/m18-adapter-client.js";

const READY = `console.log(JSON.stringify({type:"ready",name:"fake-m18",vid:1,pid:2}));`;

test("adapter commands fail within a bounded time when no acknowledgement arrives", async () => {
  const script = `${READY}process.stdin.resume();setInterval(()=>{},1000);`;
  let reported: Error | undefined;
  const client = new M18AdapterClient(async () => {}, () => {}, {
    executable: process.execPath,
    args: ["-e", script],
    commandTimeoutMs: 40,
    onDisconnect: (error) => { reported = error; }
  });
  await client.start();
  await assert.rejects(client.setBrightness(50), /timed out after 40 ms/);
  assert.match(reported?.message ?? "", /timed out after 40 ms/);
  await client.stop();
});

test("adapter exit after ready is reported once to the runtime", async () => {
  let reports = 0;
  let reportDisconnect!: (error: Error) => void;
  const disconnected = new Promise<Error>((resolve) => { reportDisconnect = resolve; });
  const script = `${READY}setTimeout(()=>process.exit(7),80);`;
  const client = new M18AdapterClient(async () => {}, () => {}, {
    executable: process.execPath,
    args: ["-e", script],
    onDisconnect: (error) => { reports += 1; reportDisconnect(error); }
  });
  const ready = await client.start();
  assert.equal(ready.name, "fake-m18");
  assert.match((await disconnected).message, /exited \(7\)/);
  assert.equal(reports, 1);
});

test("adapter shutdown remains compatible with acknowledgement-based helpers", async () => {
  const script = `${READY}
    const readline=require("node:readline").createInterface({input:process.stdin});
    readline.on("line",line=>{const command=JSON.parse(line);console.log(JSON.stringify({type:"ack",id:command.id}));if(command.type==="shutdown")process.exit(0);});`;
  const client = new M18AdapterClient(async () => {}, () => {}, {
    executable: process.execPath,
    args: ["-e", script],
    commandTimeoutMs: 200
  });
  await client.start();
  await client.setBrightness(100);
  await client.stop();
});
