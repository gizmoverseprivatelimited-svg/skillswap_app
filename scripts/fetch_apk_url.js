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
        const buildId = process.argv[2] || "26e14aa8-3a4e-4105-a279-d0b5d0beb740";
        const query = JSON.stringify({
          query: `
            query GetBuildUrl {
              builds {
                byId(buildId: "${buildId}") {
                  id
                  status
                  artifacts {
                    buildUrl
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
            "expo-session": sessionSecretStr
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
      console.error(e);
    }
  });
});

req.write(data);
req.end();
