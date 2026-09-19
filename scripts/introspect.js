const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const statePath = path.join(os.homedir(), '.expo', 'state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const sessionSecret = JSON.parse(state.auth.sessionSecret);

const query = JSON.stringify({
  query: `
    query IntrospectBuild {
      __type(name: "Build") {
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
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
    'expo-session': sessionSecret.id
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const data = JSON.parse(body);
    console.log(data.data?.__type?.fields?.map(f => f.name));
  });
});

req.on('error', e => console.error(e));
req.write(query);
req.end();
