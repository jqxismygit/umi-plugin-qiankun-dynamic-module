// ref:
// - https://umijs.org/plugins/api
import { IApi } from '@umijs/types';
import { join, parse, dirname } from 'path';
const fs = require('fs');

const DIR_NAME = 'plugin-dynamic-module';

interface ExportModule {
  name: string;
  path: string;
}

const buildExportModules = function(rootPath: string, basePrefix: string) {
  const modules: ExportModule[] = [];
  function traverse(dir: string) {
    const prefix = `${basePrefix}${dir
      .replace(rootPath, '')
      .replace(/\//g, '$')
      .replace(/\-/g, '$')}`;
    console.log('prefix = ', prefix);
    fs.readdirSync(dir).forEach((file: string) => {
      const pathname = join(dir, file);
      if (fs.statSync(pathname).isDirectory()) {
        traverse(pathname);
      } else {
        if (/\.(js|ts|jsx|tsx)$/.test(file) && !/\.d.(ts|tsx)$/.test(file)) {
          const filename = parse(pathname).name.replace(/\-/g, '$');
          if (filename === 'index') {
            modules.push({ name: prefix, path: dirname(pathname) });
          } else {
            modules.push({
              name: `${prefix}$${filename}`,
              path: join(dirname(pathname), parse(pathname).name),
            });
          }
        }
      }
    });
  }
  traverse(rootPath);
  return modules;
};

export default function(api: IApi) {
  api.logger.info('use plugin dynamic module');
  api.describe({
    key: 'dynamicModule',
    config: {
      schema(joi) {
        return joi.object({
          forceApply: joi.boolean(), //强制生效，默认只有生产环境生效
          modules: joi.array().items(joi.string()),
        });
      },
    },
  });

  const { dynamicModule = {}, qiankun } = api.userConfig;
  const {
    forceApply,
    modules = ['@sensoro/core', '@sensoro/layout', '@sensoro/library'],
  } = dynamicModule;

  const pluginEnable = api.env !== 'development' || forceApply;

  //只在qiankun生效
  if (pluginEnable && qiankun) {
    if (qiankun.slave) {
      //@ts-ignore
      api.modifyConfig(memo => {
        const extraBabelPlugins = [
          ['babel-plugin-dynamic-module', { modules }],
        ].concat(memo.extraBabelPlugins as any);
        return {
          ...memo,
          extraBabelPlugins,
        };
      });

      api.addRuntimePlugin(() => `@@/${DIR_NAME}/dynamic-use-model`);

      api.onGenerateFiles(() => {
        api.writeTmpFile({
          path: `${DIR_NAME}/dynamic-use-model.ts`,
          content: `
          import { useModel } from "umi";
          window.globalThis.useModel = useModel;`,
        });
      });
    } else if (qiankun.master) {
      api.addRuntimePlugin(() => `@@/${DIR_NAME}/index`);

      const exportModules = (modules as string[]).reduce((prev, c) => {
        const libPath = join(api.paths.absNodeModulesPath!, `${c}/lib`);
        if (fs.existsSync(libPath)) {
          return prev.concat(
            buildExportModules(
              libPath,
              `${c}/lib`
                .replace(/\@/g, '')
                .replace(/\//g, '$')
                .replace(/\-/g, '$'),
            ),
          );
        } else {
          return prev;
        }
      }, [] as ExportModule[]);

      const importContent = exportModules.reduce((prev, c) => {
        return (
          prev +
          `import * as ${c.name} from '${c.path.replace(
            `${api.paths.absNodeModulesPath}/`,
            '',
          )}';\n`
        );
      }, '');

      const mountContent = exportModules.reduce((prev, c) => {
        return prev + `window.${c.name} = ${c.name};\n`;
      }, '');

      api.onGenerateFiles(() => {
        api.writeTmpFile({
          path: `${DIR_NAME}/index.ts`,
          content: importContent + mountContent,
        });
      });
    }
  }
}
