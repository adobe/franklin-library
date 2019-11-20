#!/usr/bin/env node
/*
 * Copyright 2019 Adobe. All rights reserved.
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
const inquirer = require('inquirer');
const fs = require('fs-extra');
const chalk = require('chalk');
const path = require('path');
const { exec } = require('child_process');

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
      .replace(/@adobe\/helix-library/g, answers.fullscope)
      .replace(/Helix Library/g, answers.title)
      .replace(/An example library to be used in and with Project Helix/g, answers.description)
      .replace(/adobe\/helix-library/g, answers.fullname);
    return Buffer.from(updated);
  },
  'package-lock.json': (buf) => buf,
};

const excludes = [
  'node_modules',
  '.git',
  'template',
  '.vscode',
  'create-helix-library.js',
  'package-lock.json',
  ...Object.keys(patches),
];

function cleantitle(def) {
  if (def.match(/Helix/i)) {
    return def;
  }
  return `Helix ${def}`;
}

function cleanname(def) {
  if (def.match(/Helix/i)) {
    return def;
  }
  return `helix-${def}`;
}

inquirer.prompt(
  [{
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
    default: 'An example library to be used in and with Project Helix',
  },
  ],
)
  .then((answers) => ({
    ...answers,
    fullname: `${answers.gitorg}/${answers.name}`,
    fullscope: `@${answers.npmorg}/${answers.name}`,
  }))
  .then(async (answers) => {
    await fs.mkdir(answers.name);
    console.log(`\nCreated directory ${chalk.blue(answers.name)}\n`);
    return answers;
  })
  .then(async (answers) => {
    await fs.copy(path.resolve(__dirname), answers.name, {
      filter: (name) => {
        const relative = path.relative(__dirname, name);
        if (relative === '') {
          return true;
        }
        if (excludes.indexOf(relative) >= 0) {
          console.log(`Skipping ${chalk.red(relative)}`);
          return false;
        }
        if (fs.lstatSync(name).isFile()) {
          console.log(`Copying ${chalk.blue(relative)}`);
        }
        return true;
      },
    });
    console.log(`Copying ${chalk.blue.bold('completed\n')}`);
    return answers;
  })
  .then((answers) => Object.keys(patches).map((patchfile) => ({
    from: path.resolve(__dirname, 'template', patchfile),
    to: path.resolve(answers.name, patchfile),
    buf: fs.readFile(path.resolve(__dirname, 'template', patchfile)),
    fn: patches[patchfile],
    answers,
  })))
  .then(async (patchjobs) => {
    let answer = null;
    await Promise.all(patchjobs.map(async ({
      buf, to, fn, answers,
    }) => {
      answer = answers;
      console.log(`Patching ${chalk.green(path.basename(to))}`);
      const res = fn(await buf, answers);
      return fs.writeFile(to, res);
    }));
    console.log(`Patching ${chalk.green.bold('completed\n')}`);
    return answer;
  })
  .then(async (answers) => {
    const cwd = process.cwd();
    process.chdir(answers.name);

    await execp('git init');
    await execp(`git remote add origin https://github.com/${answers.fullname}.git`);
    await execp('git add -A');
    await execp('git commit -m \'chore(init): created repository from template\'');

    console.log(`\n\nProject ${chalk.blue(answers.name)} initialized. You can now push to GitHub\n`);
    console.log(chalk.grey('  $ cd ') + chalk.grey.bold(answers.name));
    console.log(chalk.grey('  $ git push --set-upstream origin master \n\n'));
    process.chdir(cwd);
  });
