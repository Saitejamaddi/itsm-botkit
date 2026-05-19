// bots/ITSMBot.js

var sdk     = require("./lib/sdk");
var axios   = require("axios");
var config  = require("./config");

// Load bot identifiers from environment variables to avoid committing secrets.
var botId   = process.env.BOT_ID || (config.botId || "");
var botName = process.env.BOT_NAME || (config.botName || "ITSM Bot");

// ─── Config ───────────────────────────────────────────────────────────────────

var azureConfig        = config.azureAD;
var GRAPH_TOKEN_URL    = "https://login.microsoftonline.com/" + azureConfig.tenantId + "/oauth2/v2.0/token";
var GRAPH_API_URL      = "https://graph.microsoft.com/v1.0";
var PASSWORD_METHOD_ID = "28c10230-6103-485e-b985-444c60001490";

// ─── Idle Timer ───────────────────────────────────────────────────────────────

var IDLE_TIMEOUT_MS =  5 * 60 * 1000;
var idleTimers      = {};

var REMINDER_MESSAGES = {
    rtm     : "Are you still there? I'm here to help with your IT request.",
    ivr     : "I haven't heard from you. Please say your query to continue.",
    msteams : "👋 Just checking in — are you still there? I'm ready to help.",
    default : "Are you still there? Please respond to continue your session."
};

function getSessionKey(data) {
    return (data.context && data.context.session && data.context.session.UserContext && data.context.session.UserContext._id)
        || (data.channel && data.channel.from)
        || "default";
}

function getChannel(data) {
    return (data.channel && data.channel.channelType)
        || data.channel
        || "default";
}

function clearIdleTimer(sessionKey) {
    var timer = idleTimers[sessionKey];

    if (timer) {
        clearTimeout(timer);
        clearInterval(timer);
        delete idleTimers[sessionKey];
        console.log("[IdleTimer] Cleared for session:", sessionKey);
    }
}

function startIdleTimer(sessionKey, data) {
    clearIdleTimer(sessionKey);

    idleTimers[sessionKey] = setInterval(function() {
        var channel = getChannel(data);
        var message = REMINDER_MESSAGES[channel] || REMINDER_MESSAGES["default"];
        var reminderPayload = Object.assign({}, data, { message: message });

        console.log("[IdleTimer] Sending reminder to session:", sessionKey, "on channel:", channel);

        sdk.sendUserMessage(reminderPayload, function(err) {
            if (err) {
                console.error("[IdleTimer] Failed to send reminder:", err);
            }
        });

    }, IDLE_TIMEOUT_MS);
}

// ─── Azure AD Password Reset ──────────────────────────────────────────────────

function getAzureToken() {
    var params = new URLSearchParams();
    params.append("grant_type",    "client_credentials");
    params.append("client_id",     azureConfig.clientId);
    params.append("client_secret", azureConfig.clientSecret);
    params.append("scope",         "https://graph.microsoft.com/.default")
    return axios.post(GRAPH_TOKEN_URL, params)
        .then(function(res) {
            return res.data.access_token;
        });
}

function resetUserPassword(userUpn) {
    var newPassword = "TempPass@" + Math.floor(Math.random() * 90000 + 10000); // e.g. TempPass@45231

    return getAzureToken()
        .then(function(token) {
            return axios.patch(
                GRAPH_API_URL + "/users/" + userUpn,
                {
                    passwordProfile: {
                        forceChangePasswordNextSignIn: true,
                        password: newPassword
                    }
                },
                {
                    headers: {
                        "Authorization" : "Bearer " + token,
                        "Content-Type"  : "application/json"
                    }
                }
            );
        })
        .then(function() {
            return newPassword; // return the generated password
        });
}

// ─── kore Message Handlers ────────────────────────────────────────────────────

function handleUserMessage(requestId, data, callback) {
    var sessionKey = getSessionKey(data);

    if (!data.agent_transfer) {
        startIdleTimer(sessionKey, data);
    }

    var userMessage = data.message;

    if (!userMessage || !userMessage.trim()) {
        return sdk.sendBotMessage(data, callback);
    }

    sdk.sendBotMessage(data, callback);
}

function handleBotMessage(requestId, data, callback) {
    var sessionKey = getSessionKey(data);

    if (!data.agent_transfer) {
        startIdleTimer(sessionKey, data);
    }

    sdk.sendUserMessage(data, callback);
}

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
    botId   : botId,
    botName : botName,

    on_user_message : function(requestId, data, callback) {
        handleUserMessage(requestId, data, callback);
    },

    on_bot_message : function(requestId, data, callback) {
        handleBotMessage(requestId, data, callback);
    },

    on_event : function(requestId, data, callback) {
        if (data.event && data.event.eventType === "endDialog") {
            var sessionKey = getSessionKey(data);
            clearIdleTimer(sessionKey);
            console.log("[IdleTimer] Cleared for session:", sessionKey);
        }
        callback(null, data);
    },

    on_webhook : function(requestId, data, componentName, callback) {
        var context = data.context;

        if (componentName === "ResetPassword") {
            var userUpn = context.entities.employeeUpn;

            console.log("[PasswordReset] Resetting password for:", userUpn);

            resetUserPassword(userUpn)
                .then(function(newPassword) {
                    context.passwordResetSuccess = true;
                    context.tempPassword         = newPassword;
                    console.log("[PasswordReset] Success for:", userUpn);
                    callback(null, data);
                })
                .catch(function(err) {
                    console.error("[PasswordReset] Failed:", err.response && err.response.data || err.message);
                    context.passwordResetSuccess = false;
                    context.passwordResetError   = err.message;
                    callback(null, data);
                });
        }
    }
};