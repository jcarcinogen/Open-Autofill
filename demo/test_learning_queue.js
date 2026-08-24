const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = { console, setTimeout, clearTimeout };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "shared.js"), "utf8"), ctx);

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

(async () => {
  const queue = ctx.FM.createSerialTaskQueue();
  const order = [];
  let active = 0;
  let maxActive = 0;
  const task = (name, delay) =>
    queue(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(name + ":start");
      await new Promise((resolve) => setTimeout(resolve, delay));
      order.push(name + ":end");
      active -= 1;
    });

  await Promise.all([task("dob", 20), task("email", 0), task("rules", 0)]);
  assert(maxActive === 1, "auto-learn tasks must never write storage concurrently");
  assert(
    order.join(",") === "dob:start,dob:end,email:start,email:end,rules:start,rules:end",
    "auto-learn tasks must retain event order"
  );
  console.log("ok");
})().catch((error) => {
  console.error("FAIL", error.message);
  process.exit(1);
});
