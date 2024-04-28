import { BARE_IMPORT_RE, PRE_BUNDLE_DIR } from '../constants';
import { Plugin } from '../plugin';
import { ServerContext } from '../server';
import { isJSRequest, normalizePath } from '../util';
import { init, parse } from 'es-module-lexer';
import MagicString from 'magic-string';
import path from 'path';

export function importAnalysisPlugin(): Plugin {
  let serverContext: ServerContext;
  return {
    name: 'm-vite:import-analysis',
    configureServer(s) {
      serverContext = s;
    },
    async transform(code, id) {
      // 只处理js请求
      if (!isJSRequest(id)) {
        return null;
      }
      await init;
      // 解析import语句
      const [imports] = parse(code);
      const ms = new MagicString(code);
      // 对每一个import语句进行分析
      for (const importInfo of imports) {
        // 举例说明: const str = `import React from 'react'`
        // str.slice(s, e) => 'react'
        const { s: modStart, e: modEnd, n: modSource } = importInfo;
        if (!modSource) {
          return null;
        }
        // 第三方库: 路径重写到预构建产物的路径 bare import
        if (BARE_IMPORT_RE.test(modSource)) {
          const bundlePath = normalizePath(
            path.join('/', PRE_BUNDLE_DIR, `${modSource}.js`)
          );
          ms.overwrite(modStart, modEnd, bundlePath);
        } else if (modSource.startsWith('.' || modSource.startsWith('/'))) {
          // @ts-ignore 直接调用插件上下文的 resolve 方法，会自动经过路径解析插件的处理
          const resolved = await this.resolve(modSource, id);
          if (resolved) {
            ms.overwrite(modStart, modEnd, resolved.id);
          }
        }
      }
      return {
        code: ms.toString(),
        // 生成 sourceMap
        map: ms.generateMap(),
      };
    },
  };
}
