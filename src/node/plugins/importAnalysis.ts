import {
  BARE_IMPORT_RE,
  CLIENT_PUBLIC_PATH,
  PRE_BUNDLE_DIR,
} from '../constants';
import { Plugin } from '../plugin';
import { ServerContext } from '../server';
import {
  cleanUrl,
  getShortName,
  isInternalRequest,
  isJSRequest,
  normalizePath,
} from '../util';
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
      if (!isJSRequest(id) || isInternalRequest(id)) {
        return null;
      }
      await init;
      // 解析import语句
      const [imports] = parse(code);
      const ms = new MagicString(code);

      // HMR 更新的文件
      const resolve = async (id: string, importer: string) => {
        // @ts-ignore 直接调用插件上下文的 resolve 方法，会自动经过路径解析插件的处理
        const resolved = await this.resolve(id, normalizePath(importer));
        if (!resolved) {
          return;
        }
        const cleanedId = cleanUrl(resolved.id);
        const mod = moduleGraph.getModuleById(cleanedId);
        let resolvedId = `/${getShortName(resolved.id, serverContext.root)}`;
        if (mod && mod.lastHMRTimestamp > 0) {
          resolvedId = `${resolvedId}?t=${mod.lastHMRTimestamp}`;
        }
        return resolvedId;
      };

      // 生成模块之间的依赖关系
      const { moduleGraph } = serverContext;
      const curMod = moduleGraph.getModuleById(id)!;
      const importedModules = new Set<string>();

      // 对每一个import语句进行分析
      for (const importInfo of imports) {
        // 举例说明: const str = `import React from 'react'`
        // str.slice(s, e) => 'react'
        const { s: modStart, e: modEnd, n: modSource } = importInfo;
        if (!modSource || isInternalRequest(modSource)) {
          continue;
        }
        // 处理静态资源
        if (modSource.endsWith('.svg')) {
          // 加上import后缀
          const resolveUrl = path.join(path.dirname(id), modSource);
          ms.overwrite(modStart, modEnd, `${resolveUrl}?import`);
          continue;
        }
        // 第三方库: 路径重写到预构建产物的路径 bare import
        if (BARE_IMPORT_RE.test(modSource)) {
          const bundlePath = normalizePath(
            path.join('/', PRE_BUNDLE_DIR, `${modSource}.js`)
          );
          ms.overwrite(modStart, modEnd, bundlePath);
          importedModules.add(bundlePath);
        } else if (modSource.startsWith('.' || modSource.startsWith('/'))) {
          const resolved = await resolve(modSource, id);
          if (resolved) {
            ms.overwrite(modStart, modEnd, resolved);
            importedModules.add(resolved);
          }
        }
      }
      // 只针对业务代码注入
      if (!id.includes('node_modules')) {
        // 注入 HMR 相关的工具函数
        ms.prepend(
          `import { createHotContext as __vite__createHotContext } from "${CLIENT_PUBLIC_PATH}";` +
            `import.meta.hot = __vite__createHotContext(${JSON.stringify(cleanUrl(curMod.url))});`
        );
      }
      moduleGraph.updateModuleInfo(curMod, importedModules);
      return {
        code: ms.toString(),
        // 生成 sourceMap
        map: ms.generateMap(),
      };
    },
  };
}
