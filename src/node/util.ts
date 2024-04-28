import path from 'path';
import os from 'os';

function slash(id: string) {
  return id.replace(/\\/g, '/');
}

export const isWindows = os.platform() === 'win32';

export function normalizePath(id: string): string {
  return path.posix.normalize(isWindows ? slash(id) : id);
}
