// Test-only fault injection: perform a real partial write, then simulate EIO.
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const originalOpen = fs.open;
fs.open = async (...args) => {
  const handle = await originalOpen(...args);
  if (args[1] === 'wx') {
    const write = handle.writeFile.bind(handle);
    handle.writeFile = async data => {
      await write(data.slice(0, 32));
      throw Object.assign(new Error('Injected partial-write failure'), { code: 'EIO' });
    };
  }
  return handle;
};
syncBuiltinESMExports();
