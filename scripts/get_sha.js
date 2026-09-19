const https = require('https');

const data = JSON.stringify({
  username: 'shersinghdev8474',
  password: '3e(YP(5e#9g-8($'
});

const req = https.request({
  hostname: 'api.expo.dev',
  port: 443,
  path: '/v2/auth/loginAsync',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const sessionSecret = JSON.parse(body)?.data?.sessionSecret;
      const query = JSON.stringify({
        query: `
          query GetKeystore {
            app {
              byFullName(fullName: "@shersinghdev8474/leteski-app") {
                androidAppBuildCredentialsList {
                  id
                  androidKeyStore {
                    id
                    sha1Fingerprint
                    sha256Fingerprint
                  }
                }
              }
            }
          }
        `
      });

      const gqlReq = https.request({
        hostname: 'api.expo.dev',
        port: 443,
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(query),
          'expo-session': sessionSecret
        }
      }, gqlRes => {
        let gBody = '';
        gqlRes.on('data', d => gBody += d);
        gqlRes.on('end', () => console.log(JSON.stringify(JSON.parse(gBody), null, 2)));
      });
      gqlReq.write(query);
      gqlReq.end();
    } catch (e) {
      console.error(e);
    }
  });
});
req.write(data);
req.end();
