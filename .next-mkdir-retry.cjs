const fs = require("node:fs");
const mkdir = fs.mkdir.bind(fs);
const mkdirPromise = fs.promises.mkdir.bind(fs.promises);
const isRace = e => e && (e.code === "EPERM" || e.code === "EACCES" || e.code === "ENOENT");
fs.mkdir = function(path, ...args) {
  const cb = args.pop();
  const attempt = left => mkdir(path, ...args, (err, result) => {
    if (isRace(err) && left > 0) return setTimeout(() => attempt(left - 1), 25);
    cb(err, result);
  });
  attempt(7);
};
fs.promises.mkdir = async function (path, opts) {
  for (let i = 0; ; i++) {
    try { return await mkdirPromise(path, opts); }
    catch (e) { if (!isRace(e) || i === 7) throw e; await new Promise(resolve => setTimeout(resolve, 25)); }
  }
};
