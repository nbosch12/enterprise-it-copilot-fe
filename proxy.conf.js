const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');

const TARGET = 'https://docupedia-grounding-api.cfapps.eu10-004.hana.ondemand.com';

// Node ignores the Windows PAC/system proxy, so the corporate proxy must be passed explicitly.
const CORPORATE_PROXY =
  process.env.HTTPS_PROXY || process.env.https_proxy || 'http://rb-proxy-in.bosch.com:8080';

/** https.Agent that reaches the target through an HTTP CONNECT tunnel. */
class CorporateProxyAgent extends https.Agent {
  constructor(proxyUrl, options) {
    super(options);
    this.proxy = new URL(proxyUrl);
  }

  createConnection(options, callback) {
    const target = `${options.host}:${options.port || 443}`;
    const req = http.request({
      host: this.proxy.hostname,
      port: this.proxy.port || 80,
      method: 'CONNECT',
      path: target,
      headers: { Host: target },
    });

    req.once('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        callback(new Error(`Proxy CONNECT to ${target} failed: ${res.statusCode}`));
        return;
      }
      callback(
        null,
        tls.connect({ ...options, socket, servername: options.servername || options.host })
      );
    });
    req.once('error', callback);
    req.end();
  }
}

module.exports = {
  '/api': {
    target: TARGET,
    secure: true,
    changeOrigin: true,
    logLevel: 'debug',
    agent: new CorporateProxyAgent(CORPORATE_PROXY, { keepAlive: true }),
  },
};
