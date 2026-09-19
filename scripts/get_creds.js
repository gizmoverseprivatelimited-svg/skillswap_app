const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const sessionSecret = state.auth.sessionSecret;

const query = JSON.stringify({
  query: `
    query GetAppCredentials {
      app {
        byFullName(fullName: "@shersinghdev8474/leteski-app") {
          id
          androidAppCredentials {
            id
            applicationIdentifier
            androidAppBuildCredentialsList {
              id
              name
              isDefault
              androidKeystore {
                id
                keystorePassword
                keyAlias
                keyPassword
              }
            }
          }
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
    'expo-session': sessionSecret
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Credentials:', JSON.stringify(data, null, 2));
    } catch(e) {
      console.error(e, body);
    }
  });
});
req.on('error', console.error);
req.write(query);
req.end();
