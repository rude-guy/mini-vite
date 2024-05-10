import {
  LoadResult,
  PartialResolvedId,
  PluginContext as RollupPluginContext,
  ResolvedId,
  TransformResult,
} from 'rollup';
import { Plugin } from './plugin';
import { resolvePlugin } from './plugins/resolve';
import { esbuildTransformPlugin } from './plugins/esbuild';
import { importAnalysisPlugin } from './plugins/importAnalysis';
import { cssPlugin } from './plugins/css';

export interface PluginContainer {
  resolveId(id: string, importer?: string): Promise<PartialResolvedId | null>;
  load(id: string): Promise<LoadResult | null>;
  transform(code: string, id: string): Promise<TransformResult | null>;
}

export function resolvePlugins(): Plugin[] {
  return [
    resolvePlugin(),
    esbuildTransformPlugin(),
    importAnalysisPlugin(),
    cssPlugin(),
  ];
}

// 模拟 Rollup 的插件机制
export const createPluginContainer = (plugins: Plugin[]): PluginContainer => {
  // 插件上下文对象
  class Context implements RollupPluginContext {
    // @ts-ignore 这里仅实现上下文对象的 resolve 方法
    async resolve(id: string, importer?: string) {
      let out = await pluginContainer.resolveId(id, importer);
      if (typeof out === 'string') return { id: out };
      return out as ResolvedId | null;
    }
  }

  // 插件容器
  const pluginContainer: PluginContainer = {
    async resolveId(id: string, importer?: string) {
      const ctx = new Context();
      for (const plugin of plugins) {
        if (typeof plugin.resolveId === 'function') {
          const newId = await plugin.resolveId.call(ctx, id, importer);
          if (newId) {
            const id = typeof newId === 'string' ? newId : newId.id;
            return { id };
          }
        }
      }
      return null;
    },
    async load(id) {
      const ctx = new Context();
      for (const plugin of plugins) {
        if (typeof plugin.load === 'function') {
          const result = await plugin.load.call(ctx, id);
          if (result) return result;
        }
      }
      return null;
    },
    async transform(code, id) {
      const ctx = new Context();
      for (const plugin of plugins) {
        if (typeof plugin.transform === 'function') {
          const result = await plugin.transform.call(ctx, code, id);
          if (!result) {
            continue;
          }
          if (typeof result === 'string') {
            code = result;
          } else if (result.code) {
            code = result.code;
          }
        }
      }
      return { code };
    },
  };

  return pluginContainer;
};
