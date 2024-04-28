import { Plugin } from 'esbuild';
import { BARE_IMPORT_RE, EXTERNAL_TYPES } from '../constants';

export function scanPlugin(deps: Set<string>): Plugin {
  return {
    name: 'esbuild:scan-deps',
    setup(build) {
      build.onResolve(
        {
          filter: new RegExp(`\\.(${EXTERNAL_TYPES.join('|')})\$`),
        },
        (resolveInfo) => {
          return {
            path: resolveInfo.path,
            /** 标记为外部依赖 */
            external: true,
          };
        }
      );
      // 匹配 bare import
      build.onResolve({ filter: BARE_IMPORT_RE }, (resolveInfo) => {
        const { path } = resolveInfo;
        deps.add(path);
        return {
          path,
          external: true,
        };
      });
    },
  };
}
