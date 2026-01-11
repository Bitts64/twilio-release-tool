'use strict';

import { execSync } from 'child_process';
import { EOL } from 'os';

/**
 * Assert that there are no uncommitted changes.
 * @param {string} root
 * @returns {undefined}
 * @throws {Error}
 */
function assertNoUncommittedChanges(root) {
  return [
    execSync.bind(null, 'git diff --quiet', { cwd: root }),
    execSync.bind(null, 'git diff --cached --quiet', { cwd: root })
  ].forEach(function runChecks(check) {
    try {
      check();
    } catch (error) {
      throw new Error('You have uncommitted changes');
    }
  });
}

/**
 * Assert that a git tag does not already exist.
 * @param {string} root
 * @param {string} tag
 * @returns {undefined}
 * @throws {Error}
 */
function assertTagDoesNotExist(root, tag) {
  var tags;
  try {
    tags = execSync('git tag -l', { cwd: root }).toString();
  } catch (error) {
    throw new Error('Unable to list git tags');
  }
  if (tags.split(EOL).indexOf(tag) > -1) {
    throw new Error("git tag already exists '" + tag + "'");
  }
}

/**
 * Get current branch.
 * @param {string} root
 * @returns {string}
 * @throws {Error}
 */
function getBranch(root) {
  var branch;
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root }).toString();
  } catch (error) {
    throw new Error('Unable to get branch');
  }
  return branch.replace(EOL, '');
}

const _assertNoUncommittedChanges = assertNoUncommittedChanges;
export { _assertNoUncommittedChanges as assertNoUncommittedChanges };
const _assertTagDoesNotExist = assertTagDoesNotExist;
export { _assertTagDoesNotExist as assertTagDoesNotExist };
const _getBranch = getBranch;
export { _getBranch as getBranch };
