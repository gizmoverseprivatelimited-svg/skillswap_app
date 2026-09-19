const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const data = JSON.stringify({
  username: "shersingh309892",
  password: "wS8PB!RGYcVnft5"
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
      const sessionSecret = parsed?.data?.sessionSecret;
      if (sessionSecret) {
        console.log("Logged in successfully as shersinghdev8474!");
        
        // Write state.json with updated sessionSecret
        const statePath = path.join(os.homedir(), ".expo", "state.json");
        const dir = path.dirname(statePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        const stateContent = {
          auth: {
            sessionSecret: sessionSecret,
            userId: "913a48e4-8451-4f11-9a74-4b5522e85a62",
            username: "shersinghdev8474"
          }
        };
        fs.writeFileSync(statePath, JSON.stringify(stateContent, null, 2), "utf8");
        console.log("Updated ~/.expo/state.json successfully!");

        const profile = process.argv[2] || "production";
        console.log(`Starting EAS build with profile: ${profile}...`);
        const result = execSync(`npx eas-cli build -p android --profile ${profile} --non-interactive --no-wait --json`, {
          encoding: "utf8",
          env: { ...process.env, EAS_NO_VCS: "1" }
        });
        console.log("EAS Build Triggered successfully!");
        console.log(result);
      } else {
        console.error("Login failed:", body);
      }
    } catch (e) {
      console.error("Error executing build:", e);
    }
  });
});

req.on("error", err => console.error("Request Error:", err));
req.write(data);
req.end();
