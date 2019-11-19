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
const inquirer = require('inquirer');

function title(def) {
  if (def.match(/Helix/i)) {
    return def;
  }
  return `Helix ${def}`;
}

function name(def) {
  if (def.match(/Helix/i)) {
    return def;
  }
  return `helix-${def}`;
}

inquirer.prompt(
  [{
    name: 'title',
    message: 'Title of the project (human readable)',
    default: title(process.argv.slice(2).join(' '))
  },
  {
    name: 'name',
    message: 'Name of the project (lowercase, for GitHub)',
    default: (({title}) => name(title.toLowerCase().replace(/ /g, '-')))
  },
  {
    name: 'org',
    message: 'Name of the org (for NPM)',
    default: 'adobe'
  },
  {
    name: 'description',
    message: 'Description (for the README)',
    default: 'An example library to be used in and with Project Helix'
  }
]
)
.then(answers => ({
  ...answers,
  fullname: `${answers.org}/${answers.name}`,
  fullscope: `@${answers.org}/${answers.name}`
}))
.then(answers => console.log(answers));