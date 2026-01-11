'use strict';

import { request as _request } from 'https';

function triggerBuild(program) {
  return new Promise(function triggerBuildPromise(resolve, reject) {
    const hostname = program.ci === 'travis-pro' ? 'api.travis-ci.com' : 'api.travis-ci.org';
    var options = {
      hostname,
      port: 443,
      path: '/repo/' + encodeURIComponent(program.slug) + '/requests',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Travis-API-Version': 3,
        'Authorization': 'token ' + program.token,
      }
    };

    var body = {
      request: {
        branch: program.branch,
        config: {
          // eslint-disable-next-line camelcase
          after_success: './node_modules/.bin/release -b ' + program.branch +
            ' -n' +
            (program.publish ? ' -p' : '') +
            ' -x ' +
            program.currentVersion + ' ' +
            program.releaseVersion +
            (program.developmentVersion ? ' ' + program.developmentVersion : '')
        }
      }
    };

    var request = _request(options, function withResponse(response) {
      var responseBody = '';

      response.on('data', function onData(chunk) {
        responseBody += chunk;
      });

      response.once('end', function onceEnded() {
        resolve(responseBody);
      });
    });

    request.once('error', function onceErrored(error) {
      reject(error);
    });

    request.end(JSON.stringify(body));
  });
}

const _triggerBuild = triggerBuild;
export { _triggerBuild as triggerBuild };
