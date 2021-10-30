const fs = require('fs');
const path = require('path');
const request = require('request');
const keyOrReservedWord = ['delete', 'default'];
const excludeFiles = ['typings.d.ts', 'index.ts', 'paths.d.ts'];

const getBlankspace = (n) => new Array(n).fill(' ').join('');

class GenAPIPathTypePlugin {
  apply(compiler) {
    compiler.hooks.done.tap('Hello World Plugin', () => {
      // 1. 根据接口生成 api path类型
      request('http://localhost:8022/', function (err, data, body) {
        if (err) throw new Error(err);
        const paths = JSON.parse(body).paths;
        const keys = Object.keys(paths).filter((i) => i.startsWith('/api'));

        const getPathTypeStr = (str) => {
          const prefix = `
    /**
     * ${str}'
     */
    `;
          const types = str.replace('/api/', '').split('/');
          let pathStr = `export const path = '${str}';`;
          for (let i = types.length - 1; i >= 0; i--) {
            // 如果是关键字或保留字，加下划线
            let type = keyOrReservedWord.indexOf(types[i]) > -1 ? types[i] + '_' : types[i];
            if (types.indexOf(type) !== i) {
              type = types[i] + '_';
            }
            pathStr = `export namespace ${type} {
      ${getBlankspace(i)}${pathStr}
    ${getBlankspace(i)}}`;
            if (i === 0) pathStr += '\n';
          }

          return prefix + pathStr;
        };

        const res = keys.reduce((acc, cur, index) => {
          return (acc = acc + getPathTypeStr(cur) + (index === keys.length - 1 ? '}' : ''));
        }, 'export namespace OpenAPI {');

        fs.writeFile(path.resolve('src/services', 'paths.d.ts'), res, (err) => {
          if (err) throw new Error(error);
          walkReaddir('src/services');
        });
      });
    });
  }
}

function walkReaddir(dirPath) {
  if (fs.existsSync(dirPath)) {
    let files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      let filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        walkReaddir(filePath);
      } else {
        if (!excludeFiles.includes(file)) {
          replaceCont(filePath);
        }
      }
    });
  }
}

function replaceCont(filePath) {
  fs.readFile(filePath, function (err, data) {
    if (err) throw new Error(error);
    let str = data.toString();
    str = str.replace(/\'\/api(.)+\'/g, function ($1) {
      var arr = ['OpenAPI'];
      $1.replace(/(\/api\/|\')/g, '')
        .split('/')
        .forEach((i) => {
          arr.push(i);
        });
      arr.push('path');
      return arr.join('.');
    });

    if (!str.includes("import { OpenAPI } from '../paths'")) {
      const pos = str.indexOf("import { request } from 'umi';");
      const pre = str.slice(0, pos + 30);
      const tail = str.slice(pos + 30);
      str = pre + "\nimport { OpenAPI } from '../paths'\n" + tail;
    }

    fs.writeFileSync(filePath, str, function (err) {
      if (err) throw new Error(error);
    });
  });
}

module.exports = GenAPIPathTypePlugin;
