const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
let sessionSecret = state.auth.sessionSecret;
if (typeof sessionSecret === 'string' && sessionSecret.startsWith('{')) {
  sessionSecret = JSON.parse(sessionSecret).id;
} else if (typeof sessionSecret === 'object' && sessionSecret.id) {
  sessionSecret = sessionSecret.id;
}

const query = JSON.stringify({
  query: `
    query {
      __schema {
        mutationType {
          fields {
            name
            type {
              name
              fields {
                name
                args {
                  name
                }
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
      const fields = data.data?.__schema?.mutationType?.fields || [];
      const match = fields.find(f => f.name === 'androidKeystore');
      console.log('androidKeystore subfields:', JSON.stringify(match, null, 2));
    } catch(e) {
      console.error(e, body);
    }
  });
});
req.on('error', console.error);
req.write(query);
req.end();
