const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const statePath = path.join(os.homedir(), '.expo', 'state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

const buildId = process.argv[2] || "ad714efe-dbb2-43cb-a946-ab3774b4eab8";

const query = JSON.stringify({
  query: `
    query AppBuildLog {
      builds {
        byId(buildId: "${buildId}") {
          id
          status
          error {
            message
            errorCode
          }
          logFiles
        }
      }
    }
  `
});

const req = https.request({
  hostname: 'api.expo.dev',
  port: 443,
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(query),
    'expo-session': state.auth.sessionSecret
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log('Build data:', JSON.stringify(parsed, null, 2));
      const logFiles = parsed?.data?.builds?.byId?.logFiles;
      if (logFiles && logFiles.length > 0) {
        console.log('Downloading log from:', logFiles[0]);
        https.get(logFiles[0], logRes => {
          let logData = '';
          logRes.on('data', c => logData += c);
          logRes.on('end', () => {
            fs.writeFileSync('eas_build_log.txt', logData);
            console.log('Saved eas_build_log.txt, total characters:', logData.length);
          });
        });
      }
    } catch (e) {
      console.error(e);
    }
  });
});

req.on('error', e => console.error(e));
req.write(query);
req.end();
