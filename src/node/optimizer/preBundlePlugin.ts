import { Loader, Plugin } from 'esbuild';
import { BARE_IMPORT_RE } from '../constants';
import resolve from 'resolve';
// 用来分析 es 模块 import/export 语句的库
import { init, parse } from 'es-module-lexer';
import { normalizePath } from '../util';
import fs from 'fs-extra';
import createDebug from 'debug';
import path from 'path';

const debug = createDebug('dev');

export function preBundlePlugin(deps: Set<string>): Plugin {
  return {
    name: 'esbuild:pre-bundle',
    setup(build) {
      build.onResolve({ filter: BARE_IMPORT_RE }, (resolveInfo) => {
        const { path: id, importer } = resolveInfo;
        const isEntry = !importer;
        // 是否命中需要预构建的依赖
        if (deps.has(id)) {
          // 若为入口，则标记 dep 的 namespace
          return isEntry
            ? {
                path: id,
                namespace: 'dep',
              }
            : {
                // 因为走到 onResolve 了，所以这里的 path 就是绝对路径了
                path: resolve.sync(id, { basedir: process.cwd() }),
              };
        }
      });
      // 拿到标记后的依赖，构造代理模块，交给 esbuild 打包
      build.onLoad({ filter: /.*/, namespace: 'dep' }, async (loadInfo) => {
        await init;
        const root = process.cwd();
        const id = loadInfo.path;
        const entryPath = normalizePath(resolve.sync(id, { basedir: root }));
        const code = await fs.readFile(entryPath, 'utf-8');
        const [imports, exports] = parse(code);
        let proxyModule = [];
        // cjs
        if (!imports.length && !exports.length) {
          // 构造代理模块
          const res = require(entryPath);
          const specifiers = Object.keys(res);
          proxyModule.push(
            `export { ${specifiers.join(',')} } from "${entryPath}"`,
            `export default require("${entryPath}")`
          );
        } else {
          // esm 格式比较好处理，export * 或者 export default 即可
          if (exports.some((v) => v.n === 'default')) {
            proxyModule.push(`import d from "${entryPath}"; export default d`);
          }
          proxyModule.push(`export * from "${entryPath}"`);
        }

        debug('代理模块内容: %o', proxyModule.join('\n'));
        const loader = path.extname(entryPath).slice(1);
        return {
          loader: loader as Loader,
          contents: proxyModule.join('\n'),
          resolveDir: root,
        };
      });
    },
  };
}
