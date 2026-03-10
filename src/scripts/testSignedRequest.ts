import crypto from "crypto";

const clientId = "clinic-site-aarhus";
const clientSecret = "replace-with-aarhus-secret";
const timestamp = Math.floor(Date.now() / 1000).toString();

const body = {
  message: "What is your phone number?",
  sessionId: "test-session-1",
  pageUrl: "https://example.com/contact",
};

const bodyString = JSON.stringify(body);
const payload = `${timestamp}.${bodyString}`;

const signature = crypto
  .createHmac("sha256", clientSecret)
  .update(payload, "utf8")
  .digest("hex");

console.log(`
curl -X POST http://localhost:3000/api/chat \\
  -H "Content-Type: application/json" \\
  -H "X-Client-Id: ${clientId}" \\
  -H "X-Timestamp: ${timestamp}" \\
  -H "X-Signature: ${signature}" \\
  -d '${bodyString}'
`);