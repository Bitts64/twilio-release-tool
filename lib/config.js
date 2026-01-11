'use strict';

import { readJSON } from './util';

/**
 * Read .release.json.
 * @param {string} root
 * @returns {object}
 * @throws {Error}
 */
function readConfig(root) {
  return readJSON('.release.json', root);
}

export default readConfig;
