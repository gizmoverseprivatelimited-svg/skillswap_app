const https = require("https");

const data = JSON.stringify({
  username: "shersinghdev8474",
  password: "3e(YP(5e#9g-8($"
});

const req = https.request({
  hostname: "api.expo.dev",
  port: 443,
  path: "/v2/auth/loginAsync",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data)
  }
}, res => {
  let body = "";
  res.on("data", chunk => body += chunk);
  res.on("end", () => {
    try {
      const parsed = JSON.parse(body);
      const sessionSecretStr = parsed?.data?.sessionSecret;
      if (sessionSecretStr) {
        let secret = sessionSecretStr;
        try {
          const obj = JSON.parse(sessionSecretStr);
          if (obj.id) secret = obj.id;
        } catch(e) {}
        const query = JSON.stringify({
          query: `
            query AppBuilds {
              app {
                byFullName(fullName: "@shersingh309892s-team/leteski-app") {
                  id
                  builds(limit: 5, offset: 0) {
                    id
                    status
                    platform
                    createdAt
                    artifacts {
                      buildUrl
                    }
                  }
                }
              }
            }
          `
        });

        const gqlReq = https.request({
          hostname: "api.expo.dev",
          port: 443,
          path: "/graphql",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(query),
            "expo-session": secret
          }
        }, gqlRes => {
          let gqlBody = "";
          gqlRes.on("data", d => gqlBody += d);
          gqlRes.on("end", () => {
            console.log(gqlBody);
          });
        });
        gqlReq.write(query);
        gqlReq.end();
      }
    } catch (e) {
      console.error("Error:", e);
    }
  });
});

req.write(data);
req.end();
