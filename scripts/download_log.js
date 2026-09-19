const fs = require('fs');
const https = require('https');
const zlib = require('zlib');
const os = require('os');
const path = require('path');

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const buildId = process.argv[2] || "ad714efe-dbb2-43cb-a946-ab3774b4eab8";

const query = JSON.stringify({
  query: `
    query AppBuildLog {
      builds {
        byId(buildId: "${buildId}") {
          id
          status
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
    const parsed = JSON.parse(body);
    const url = parsed?.data?.builds?.byId?.logFiles?.[0];
    if (!url) {
      console.log('No log URL found');
      return;
    }
    console.log('Downloading log binary from:', url);
    https.get(url, logRes => {
      const chunks = [];
      logRes.on('data', c => chunks.push(c));
      logRes.on('end', () => {
        const fullBuf = Buffer.concat(chunks);
        let text = '';
        try {
          text = zlib.gunzipSync(fullBuf).toString('utf8');
        } catch(e) {
          try {
            text = zlib.inflateSync(fullBuf).toString('utf8');
          } catch(e2) {
            text = fullBuf.toString('utf8');
          }
        }
        fs.writeFileSync('eas_build_log_clean.txt', text);
        console.log('Saved eas_build_log_clean.txt! Total lines:', text.split('\n').length);
      });
    });
  });
});
req.write(query);
req.end();
