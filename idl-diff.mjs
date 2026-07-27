import fs from "fs";
const on = JSON.parse(fs.readFileSync("/tmp/sap-onchain-idl.json", "utf8"));
const off = JSON.parse(fs.readFileSync("./node_modules/@oobe-protocol-labs/synapse-sap-sdk/dist/esm/idl/synapse_agent_sap.json", "utf8"));
const onN = on.instructions.map(i => i.name).sort();
const offN = off.instructions.map(i => i.name).sort();
console.log("on-chain instructions :", onN.length);
console.log("sdk-bundled           :", offN.length);
const only = onN.filter(n => offN.indexOf(n) === -1);
console.log("\nIN DEPLOYED PROGRAM BUT NOT IN SDK:");
console.log(only.length ? only.join("\n") : "  (none)");
console.log("\npricing / migrate / init on-chain:", onN.filter(n => /pricing|menu|migrat|init/i.test(n)));
const u = on.instructions.find(i => /update_agent|updateAgent/.test(i.name));
if (u) { console.log("\ndeployed update_agent accounts:"); u.accounts.forEach(a => console.log("  ", a.name, a.optional ? "(optional)" : "")); }
