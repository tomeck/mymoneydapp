const WebSocket = require('ws');
const http = require("http");

const merchantATA = "BKXegaxeo31kzbY6dVHugfW9NfdaTSPTwcza8JXxd9b4";

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

setupWebSocket();

// *********
// Functions
// *********
async function setupWebSocket() {

  const ws = new WebSocket('wss://api.devnet.solana.com/ ');

  ws.onopen = function() {
      console.log('WebSocket Client Connected');
      const resp = ws.send(getAccountSubscriptionMessage(merchantATA));
      console.log("Resp is", resp);
      // returns '{"jsonrpc":"2.0","result":13101304,"id":1}'
  };
  ws.onmessage = function(e) {
    console.log("Received: '" + e.data + "'");
  };

}

// 
// response looks like '{"jsonrpc":"2.0","method":"accountNotification","params":{"result":{"context":{"slot":108458666},"value":{"lamports":2039280,"data":["oVEjzlFybwaC5GlzDnf0IR6LvOlvDo4kiJf72CYGLFHlfoHQ7tps37JP5wlpxiZ9IOL23DmT061vUJdqRb8abgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","base64"],"owner":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","executable":false,"rentEpoch":251}},"subscription":13101304}}'
function getAccountSubscriptionMessage(publicKey) {
  const jsonObj = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "accountSubscribe",
    "params": [
      publicKey,
      {
        "encoding": "base64",
        "commitment": "finalized"
      }
    ]
  }

  // implicit return
  return JSON.stringify(jsonObj);
}
