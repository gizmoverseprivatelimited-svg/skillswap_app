const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const state = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'));
const sessionSecret = state.auth.sessionSecret;

const accountId = "76036489-d534-4209-8ff1-57eac6bff2a7";
const buildCredentialsId = "f5fd86da-7830-4a60-9fd5-40a466b53f86";

const jksPath = path.join(__dirname, "..", "expo ssh1", "@anonymousepersondev__leteski-community-90mlx56-keystore.bak.jks");
const base64EncodedKeystore = fs.readFileSync(jksPath).toString("base64");

const keystoreInput = {
  base64EncodedKeystore,
  keystorePassword: "6854861fce2b1fac30fb836092571731",
  keyAlias: "36ba1ca761d71999892d7a1d6b9dd8f2",
  keyPassword: "6f04453d9b65bbf1b113b2329554e782"
};

function gql(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const req = https.request({
      hostname: 'api.expo.dev',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'expo-session': sessionSecret
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log("1. Creating Keystore on EAS Account...");
  const createMutation = `
    mutation CreateAndroidKeystore($accountId: ID!, $androidKeystoreInput: AndroidKeystoreInput!) {
      androidKeystore {
        createAndroidKeystore(accountId: $accountId, androidKeystoreInput: $androidKeystoreInput) {
          id
        }
      }
    }
  `;
  const createRes = await gql(createMutation, {
    accountId,
    androidKeystoreInput: keystoreInput
  });
  console.log("Create result:", JSON.stringify(createRes, null, 2));

  const newKeystoreId = createRes?.data?.androidKeystore?.createAndroidKeystore?.id;
  if (!newKeystoreId) {
    console.error("Failed to create keystore on EAS!");
    process.exit(1);
  }

  console.log("2. Linking new Keystore to App Build Credentials...");
  const setMutation = `
    mutation SetKeystore($id: ID!, $keystoreId: ID!) {
      androidAppBuildCredentials {
        setKeystore(id: $id, keystoreId: $keystoreId) {
          id
          androidKeystore {
            id
            keyAlias
          }
        }
      }
    }
  `;
  const setRes = await gql(setMutation, {
    id: buildCredentialsId,
    keystoreId: newKeystoreId
  });
  console.log("Set result:", JSON.stringify(setRes, null, 2));

  console.log("SUCCESS! Keystore updated on EAS for @shersinghdev8474/leteski-app.");
}

run().catch(console.error);
