/* eslint-disable no-console */
/* eslint-disable no-process-env */
'use strict';

import bump from './bump';
import cli from './cli';
import { yellow, bold, cyan } from 'colors';
import { getVariablesForConfigPlan } from './env';
import getPlansFromConfig from './plans';
import { assertTagDoesNotExist, assertNoUncommittedChanges, getBranch } from './git';
import { EOL } from 'os';
import pkg from '../package';
import readConfig from './config';
import { major, minor, patch, inc } from 'semver';
import { setCIEnvironment, triggerBuild } from './ci';
import { input, confirm, password } from './ui';
import { readJSON } from './util';
import { assertValidSemanticVersion, assertValidDevelopmentVersion, isReleaseCandidateVersion, assertValidReleaseOrReleaseCandidateVersion as _assertValidReleaseOrReleaseCandidateVersion } from './version';

function getCurrentVersion(process, program, root, constants) {
  var validation = program.bump
    ? assertValidSemanticVersion
    : assertValidDevelopmentVersion;

  function setCurrentVersion(currentVersion) {
    validation(currentVersion);
    program.currentVersion = currentVersion;
    constants.set('CURRENT_VERSION', currentVersion);
    return currentVersion;
  }

  var currentVersion = program.args[0] || process.env.CURRENT_VERSION;
  if (!currentVersion) {
    if (program.nonInteractive) {
      return Promise.reject(new Error('Current version must be specified'));
    }
    var pkg = readJSON('package.json', root, false);
    if (pkg) {
      currentVersion = pkg.version;
    } else {
      return input(
          'Current Version:',
          validation
        ).then(setCurrentVersion);
    }
  }

  if (!program.nonInteractive) {
    console.log('%s %s %s', yellow('!'),
      bold('Current Version:'), cyan(currentVersion));
  }
  return setCurrentVersion(currentVersion);
}

function getDevelopmentVersion(process, program, root, constants) {
  function setDevelopmentVersion(developmentVersion) {
    if (developmentVersion) {
      assertValidDevelopmentVersion(developmentVersion);
      program.developmentVersion = developmentVersion;
      constants.set('DEVELOPMENT_VERSION', developmentVersion);
    }
    return developmentVersion;
  }

  var developmentVersion = program.args[2] || process.env.DEVELOPMENT_VERSION;
  if (program.bump) {
    return Promise.resolve(null);
  } else if (!developmentVersion) {
    if (program.nonInteractive) {
      return Promise.resolve(null);
    }
    return confirm('Continue development?', true)
      .then(function withAnswer(answer) {
        if (!answer) {
          return Promise.resolve(null);
        }
        var defaultDevelopmentVersion = [
          major(program.releaseVersion),
          minor(program.releaseVersion),
          patch(program.releaseVersion)
        ].join('.');
        if (!isReleaseCandidateVersion(program.releaseVersion)) {
          defaultDevelopmentVersion = inc(defaultDevelopmentVersion,
            'patch');
        }
        defaultDevelopmentVersion += '-dev';
        return input(
          'Development Version:',
          assertValidDevelopmentVersion,
          defaultDevelopmentVersion
        ).then(setDevelopmentVersion);
      });
  }

  if (!program.nonInteractive) {
    if (developmentVersion) {
      console.log('%s %s %s', yellow('!'),
        bold('Continue development?'), cyan('Yes'));
      console.log('%s %s %s', yellow('!'),
        bold('Development Version:'), cyan(developmentVersion));
    } else {
      console.log('%s %s %s', yellow('!'),
        bold('Continue development?'), cyan('No'));
    }
  }
  return setDevelopmentVersion(developmentVersion);
}

function assertValidReleaseOrReleaseCandidateVersion(root, _version) {
  _assertValidReleaseOrReleaseCandidateVersion(_version);
  assertTagDoesNotExist(root, _version);
}

function getPublish(program) {
  var publish = program.publish;

  function setPublish(publish) {
    program.publish = publish;
    return true;
  }

  if (typeof publish !== 'boolean') {
    if (program.nonInteractive) {
      return Promise.resolve(setPublish(false));
    }
    return confirm('Publish?', false).then(setPublish);
  }

  if (!program.nonInteractive) {
    console.log('%s %s %s', yellow('!'), bold('Publish?'),
      cyan(program.publish ? 'Yes' : 'No'));
  }
  return Promise.resolve(setPublish(program.publish));
}

function getReleaseOrReleaseCandidateVersion(process, program, root, constants) {
  var validation = program.bump
    ? assertValidSemanticVersion
    : assertValidReleaseOrReleaseCandidateVersion.bind(null, root);

  function setReleaseOrReleaseCandidateVersion(releaseOrReleaseCandidateVersion) {
    validation(releaseOrReleaseCandidateVersion);
    program.releaseVersion = releaseOrReleaseCandidateVersion;
    constants.set('RELEASE_VERSION', releaseOrReleaseCandidateVersion);
    return releaseOrReleaseCandidateVersion;
  }

  var releaseOrReleaseCandidateVersion =
    program.args[1] || process.env.RELEASE_VERSION;
  if (!releaseOrReleaseCandidateVersion) {
    if (program.nonInteractive) {
      return program.bump
        ? Promise.reject(new Error('Next version must be specified'))
        : Promise.reject(new Error('Release version must be specified'));
    }
    var defaultReleaseOrReleaseCandidateVersion = [
      major(program.currentVersion),
      minor(program.currentVersion),
      patch(program.currentVersion)
    ].join('.');
    return input(
        program.bump
          ? 'Next Version:'
          : 'Release (or Release Candidate) Version:',
        validation,
        defaultReleaseOrReleaseCandidateVersion
      ).then(setReleaseOrReleaseCandidateVersion);
  }

  if (!program.nonInteractive) {
    console.log('%s %s %s', yellow('!'),
      bold(program.bump
          ? 'Next Version:'
          : 'Release (or Release Candidate) Version:'),
        cyan(releaseOrReleaseCandidateVersion));
  }
  return setReleaseOrReleaseCandidateVersion(releaseOrReleaseCandidateVersion);
}

function getSlug(program, config) {
  var slug = program.slug || config.slug;
  if (program.nonInteractive) {
    if (!slug) {
      return Promise.reject(new Error('The repository slug is required'));
    }
    program.slug = slug;
    return Promise.resolve(slug);
  }
  return input('Repository slug:', function validateSlug(slug) {
      if (!slug.length) {
        throw new Error('The repository slug is required');
      }
    }, slug).then(function setSlug(slug) {
      program.slug = slug;
    });
}

function getToken(program) {
  if (program.token) {
    return Promise.resolve(program.token);
  } else if (program.nonInteractive) {
    return Promise.reject(new Error(`A ${program.ci} CI token is required`));
  }
  return password(
      `${program.ci} CI token:`,
      function validateToken(token) {
        if (!token.length) {
          throw new Error(`A ${program.ci} CI token is required`);
        }
      }
    ).then(function setToken(token) {
      program.token = token;
      return token;
    });
}

function getVersions(process, program, root, constants) {
  return Promise.resolve()
    .then(getCurrentVersion.bind(null, process, program, root, constants))
    .then(getReleaseOrReleaseCandidateVersion.bind(null, process, program, root, constants))
    .then(getDevelopmentVersion.bind(null, process, program, root, constants));
}

/**
 * Run the program.
 * @param {object} process
 * @returns Promise<object>
 */
function run(process) {
  var config;
  var constants = new Map();
  var plans;
  var plansToExecute;
  var program;
  var root = process.cwd();
  return new Promise(function runPromise(resolve) {
      config = readConfig(root);
      setCIEnvironment(config);
      program = cli(process, pkg, config);

      assertNoUncommittedChanges(root);

      if (!program.nonInteractive) {
        var prj = readJSON('package.json', root);
        var name = prj.name;
        console.log('%s %s %s', yellow('!'), bold('Name:'),
          cyan(name));
      }

      var branch = program.branch || getBranch(root);
      if (!program.nonInteractive) {
        console.log('%s %s %s', yellow('!'), bold('Branch:'),
          cyan(branch));
      }
      program.branch = branch;
      constants.set('BRANCH', branch);

      plans = getPlansFromConfig(config);
      // printIntroduction();

      resolve(program);
    }).then(getVersions.bind(null, process, program, root, constants))
    .then(function withVersions() {
      if (program.bump) {
        return bump(root, program.currentVersion, program.releaseVersion,
          config.type);
      }

      return getPublish(program).then(function confirmPlans() {
        plansToExecute = [
          ['Create Release' +
              (isReleaseCandidateVersion(program.releaseVersion)
                ? ' Candidate'
                : ''),
           'release']
        ];

        if (program.developmentVersion) {
          plansToExecute.push(['Continue Development', 'development']);
        }

        if (program.publish) {
          plansToExecute.push(['Publish', 'publish']);
        }

        if (!program.nonInteractive) {
          console.log('\n  The tool will execute the following plans in order.');
        }

        plansToExecute = plansToExecute.map(function forEachPlanToExecute(pair) {
          var planName = pair[1];
          var plan = plans.get(planName);
          if (!plan) {
            throw new Error('Plan \'' + planName + '\' does not exist');
          }
          if (!program.nonInteractive) {
            console.log('\n  %s:\n', bold(pair[0]));
            console.log(plan.toString().split(EOL).map(function indentPlan(line) {
              return '      ' + line;
            }).join(EOL));
          }
          return [planName, plan];
        });

        if (!program.nonInteractive) {
          console.log();
        }

        return (
          program.nonInteractive
            ? Promise.resolve(true)
            : confirm('Is this OK?', false)
        ).then(function withAnswer(answer) {
            if (!answer) {
              throw new Error('User aborted release');
            }

            if (!config.ci || program.execute) {
              return plansToExecute.map(function bindVariables(pair) {
                var variables = getVariablesForConfigPlan(program, config,
                  pair[0], constants, process);
                if (variables.unassigned.size) {
                  var unassigned = [];
                  variables.unassigned.forEach(function forEachUnassignedVariable(variable) {
                    unassigned.push(variable);
                  });
                  throw new Error('Unassigned variables: ' + unassigned.join(', '));
                }
                return pair[1].run.bind(pair[1], variables.assigned);
              }).forEach(function runPlan(plan) {
                plan();
              });
            }

            program.ci = config.ci;

            return getSlug(program, config)
              .then(getToken.bind(null, program))
              .then(triggerBuild.bind(null, program))
              .then(function withResponse(response) {
                // eslint-disable-next-line no-warning-comments
                // TODO(mroberts): Make pretty
                console.log(response);
              });
          });
      });
    }).catch(function onError(error) {
      console.error('\n  error: %s\n', error.message);
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    });
}

export default run;
