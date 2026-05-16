require('dotenv').config();

var jsonConfig = require('./config.json');

var config = Object.assign({}, jsonConfig);

config.azureAD = {
  tenantId: process.env.AZURE_TENANT_ID || jsonConfig.azureAD && jsonConfig.azureAD.tenantId || "",
  clientId: process.env.AZURE_CLIENT_ID || jsonConfig.azureAD && jsonConfig.azureAD.clientId || "",
  clientSecret: process.env.AZURE_CLIENT_SECRET || jsonConfig.azureAD && jsonConfig.azureAD.clientSecret || ""
};

config.credentials = {
  apikey: process.env.CREDENTIALS_APIKEY || jsonConfig.credentials && jsonConfig.credentials.apikey || "",
  appId: process.env.CREDENTIALS_APPID || jsonConfig.credentials && jsonConfig.credentials.appId || ""
};

if (jsonConfig.credentials && jsonConfig.credentials['st-67890']) {
  config.credentials['st-67890'] = jsonConfig.credentials['st-67890'];
}

config.botId = process.env.BOT_ID || "";
config.botName = process.env.BOT_NAME || "";

module.exports = config;
