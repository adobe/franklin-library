/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* eslint-disable no-console */
import inquirer from 'inquirer';
import fs from 'fs-extra';
import chalk from 'chalk-template';
import path from 'path';
import { exec } from 'child_process';

function cleantitle(def) {
  if (def.match(/Franklin/i)) {
    return def;
  }
  return `Franklin ${def}`;
}

function cleanname(def) {
  if (def.match(/Franklin/i)) {
    return def;
  }
  return `franklin-${def}`;
}

function dottify(filename) {
  if (filename.startsWith('dot-')) {
    return `.${filename.substring(4)}`;
  } else {
    return filename;
  }
}

function execp(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      }
      resolve(stdout + stderr);
    });
  });
}

export default function init(basedir, morepatches = [], morequestions = []) {
  const patches = {
    'package.json': (buf, answers) => {
      const json = JSON.parse(buf.toString());
      json.name = answers.fullscope;
      json.description = answers.title;
      json.repository.url = `https://github.com/${answers.fullname}`;
      json.bugs.url = `https://github.com/${answers.fullname}/issues`;
      json.homepage = `https://github.com/${answers.fullname}#readme`;
      return Buffer.from(JSON.stringify(json, null, 2));
    },
    'README.md': (buf, answers) => {
      const updated = buf.toString()
        .replace(/@adobe\/franklin-library/g, answers.fullscope)
        .replace(/Franklin Library/g, answers.title)
        .replace(/An example library to be used in and with Project Franklin/g, answers.description)
        .replace(/adobe\/franklin-library/g, answers.fullname);
      return Buffer.from(updated);
    },
    'CHANGELOG.md': (buf) => buf,
    'dot-eslintignore': (buf) => buf,
    'dot-npmignore': (buf) => buf,
    'dot-gitignore': (buf) => buf,
    ...morepatches,
  };

  const questions = [{
    name: 'title',
    message: 'Title of the project (human readable)',
    default: cleantitle(process.argv.slice(2).join(' ')),
  },
  {
    name: 'name',
    message: 'Name of the project (lowercase, for GitHub)',
    default: (({ title }) => cleanname(title.toLowerCase().replace(/ /g, '-'))),
  },
  {
    name: 'npmorg',
    message: 'Name of the org (for NPM)',
    default: 'adobe',
  },
  {
    name: 'gitorg',
    message: 'Name of the org (for GitHub)',
    default: 'adobe',
  },
  {
    name: 'description',
    message: 'Description (for the README)',
    default: 'An example library to be used in and with Project Franklin',
  },
  ...morequestions,
  ];

  const excludes = [
    'node_modules',
    '.git',
    'template',
    '.vscode',
    'create-franklin-library.js',
    'create-franklin-shared.js',
    'create-franklin-service.js',
    'package-lock.json',
    'CHANGELOG.md',
    ...Object.keys(patches),
  ];

  inquirer.prompt(questions)
    .then((answers) => ({
      ...answers,
      fullname: `${answers.gitorg}/${answers.name}`,
      fullscope: `@${answers.npmorg}/${answers.name}`,
    }))
    .then(async (answers) => {
      await fs.mkdir(answers.name);
      console.log(chalk`\nCreated directory {blue ${answers.name}}\n`);
      return answers;
    })
    .then(async (answers) => {
      await fs.copy(path.resolve(basedir), answers.name, {
        filter: (name) => {
          const relative = path.relative(basedir, name);
          if (relative === '') {
            return true;
          }
          if (excludes.indexOf(relative) >= 0) {
            console.log(chalk`Skipping {red ${relative}}`);
            return false;
          }
          if (fs.lstatSync(name).isFile()) {
            console.log(chalk`Copying {blue ${relative}}`);
          }
          return true;
        },
      });
      console.log(chalk`Copying {blue.bold completed}\n`);
      return answers;
    })
    .then((answers) => Object.keys(patches).map((patchfile) => ({
      from: path.resolve(basedir, 'template', patchfile),
      to: path.resolve(answers.name, dottify(patchfile)),
      buf: fs.readFile(path.resolve(basedir, 'template', patchfile)),
      fn: patches[patchfile],
      answers,
    })))
    .then(async (patchjobs) => {
      let answer = null;
      await Promise.all(patchjobs.map(async ({
        buf, to, fn, answers,
      }) => {
        answer = answers;
        console.log(chalk`Patching {green ${path.basename(to)}}`);
        const res = fn(await buf, answers);
        return fs.writeFile(to, res);
      }));
      console.log(chalk`Patching {green.bold completed}\n`);
      return answer;
    })
    .then(async (answers) => {
      const cwd = process.cwd();
      process.chdir(answers.name);

      await execp('git init');
      await execp('git checkout -b main');
      await execp(`git remote add origin https://github.com/${answers.fullname}.git`);
      await execp('git add -A');
      await execp('git commit -m \'chore(init): created repository from template\'');

      console.log(chalk`\n\nProject {blue ${answers.name}} initialized. You can now push to GitHub\n`);
      console.log(chalk`{grey   $ cd} {grey.bold ${answers.name}}`);
      console.log(chalk`{grey   $ git push --set-upstream origin main}\n\n`);
      process.chdir(cwd);
    });
}
