const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");

const statePath = path.join(os.homedir(), ".expo", "state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const sessionSecret = state.auth.sessionSecret;

const buildId = process.argv[2] || "72756fbb-75da-4a75-b83c-88e216b1de44";

const query = JSON.stringify({
  query: `
    query GetBuild {
      builds {
        byId(buildId: "${buildId}") {
          id
          status
          platform
          createdAt
          updatedAt
          artifacts {
            buildUrl
            applicationArchiveUrl
          }
        }
      }
    }
  `
});

const req = https.request(
  {
    hostname: "api.expo.dev",
    port: 443,
    path: "/graphql",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(query),
      "expo-session": sessionSecret
    }
  },
  res => {
    let body = "";
    res.on("data", chunk => (body += chunk));
    res.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const build = parsed?.data?.builds?.byId;
        if (build) {
          console.log(`Build ID: ${build.id}`);
          console.log(`Status:   ${build.status}`);
          console.log(`Platform: ${build.platform}`);
          if (build.artifacts?.buildUrl) {
            console.log(`APK Download URL: ${build.artifacts.buildUrl}`);
          }
        } else {
          console.log("Response:", body);
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    });
  }
);

req.on("error", err => console.error("Request Error:", err));
req.write(query);
req.end();
