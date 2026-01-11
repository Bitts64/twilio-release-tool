'use strict';

import { exec } from 'child_process';
import { statSync } from 'fs';
import { join } from 'path';
import semver from 'semver';

/**
 * Flip a binary function.
 * @param {function(A, B): C} f
 * @returns {function(B, A): C}
 */
function flip2(f) {
  return function flipped(a, b) {
    return f(b, a);
  };
}

function lift(f) {
  return function lifted(a) {
    return new Promise(function liftedPromise(resolve) {
      resolve(f(a));
    });
  };
}

/**
 * Read a JSON file. If it must exist, but does not, throw an Error.
 * @param {string} name
 * @param {string} jsonPath
 * @param {?boolean} [mustExist=true]
 * @returns {?object}
 * @throws {Error}
 */
function readJSON(name, jsonPath, mustExist) {
  jsonPath = join(jsonPath, name);
  mustExist = typeof mustExist === 'boolean' ? mustExist : true;
  var json;
  var jsonExists = false;
  try {
    statSync(jsonPath);
    jsonExists = true;
  } catch (error) {
    if (mustExist) {
      throw new Error(name + ' does not exist');
    } else {
      return null;
    }
  }
  try {
    return require(jsonPath);
  } catch (error) {
    throw new Error('Unable to read ' + name);
  }
}

const _flip2 = flip2;
export { _flip2 as flip2 };
const _lift = lift;
export { _lift as lift };
const _readJSON = readJSON;
export { _readJSON as readJSON };
