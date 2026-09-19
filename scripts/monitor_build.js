const https = require("https");

const buildId = process.argv[2] || "26e14aa8-3a4e-4105-a279-d0b5d0beb740";

const data = JSON.stringify({
  username: "shersinghdev8474",
  password: "3e(YP(5e#9g-8($"
});

function getSessionSecret() {
  return new Promise((resolve, reject) => {
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
          resolve(parsed?.data?.sessionSecret);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function checkBuild(sessionSecret) {
  return new Promise((resolve, reject) => {
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
              error {
                message
                errorCode
              }
            }
          }
        }
      `
    });

    const req = https.request({
      hostname: "api.expo.dev",
      port: 443,
      path: "/graphql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(query),
        "expo-session": sessionSecret
      }
    }, res => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed?.data?.builds?.byId);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(query);
    req.end();
  });
}

async function monitor() {
  const sessionSecret = await getSessionSecret();
  if (!sessionSecret) {
    console.error("Failed to authenticate with Expo.");
    process.exit(1);
  }

  console.log(`Monitoring build: ${buildId}...`);

  while (true) {
    try {
      const build = await checkBuild(sessionSecret);
      const status = build?.status;
      console.log(`[${new Date().toISOString()}] Status: ${status}`);

      if (status === "FINISHED") {
        console.log("BUILD COMPLETED SUCCESSFULLY!");
        console.log(`APK URL: ${build?.artifacts?.buildUrl}`);
        process.exit(0);
      } else if (status === "ERRORED" || status === "CANCELED") {
        console.error("BUILD FAILED OR CANCELED:", JSON.stringify(build?.error));
        process.exit(1);
      }
    } catch (err) {
      console.error("Error polling build status:", err.message);
    }

    await new Promise(r => setTimeout(r, 20000));
  }
}

monitor();
