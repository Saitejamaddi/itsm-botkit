var _ = require('lodash');

function DataStore(){
    this._languages = [];
    this._store = {};
}

DataStore.prototype.saveAllVariables = function(response, langArr){
    this._languages = _.clone(langArr || []);
    for (var i = 0; i < this._languages.length; i++) {
        this._store[this._languages[i]] = response[i] || {};
    }
    return this;
};

DataStore.prototype.addVariable = function(variable, index){
    var lang = this._languages[index];
    if (!lang) {
        return;
    }
    var current = this._store[lang];
    if (Array.isArray(current)) {
        current.push(variable);
    } else if (current && Array.isArray(current.variables)) {
        current.variables.push(variable);
    } else {
        this._store[lang] = [variable];
    }
};

DataStore.prototype.updateVariable = function(variable, langArr, index){
    var lang = langArr && langArr[index];
    if (!lang) {
        return;
    }
    var current = this._store[lang];
    var key = variable.id || variable.name;
    if (!key) {
        return;
    }

    function updateList(list){
        for (var i = 0; i < list.length; i++) {
            if ((list[i].id && list[i].id === variable.id) || (list[i].name && list[i].name === variable.name)) {
                list[i] = variable;
                return true;
            }
        }
        return false;
    }

    if (Array.isArray(current)) {
        updateList(current);
    } else if (current && Array.isArray(current.variables)) {
        updateList(current.variables);
    }
};

DataStore.prototype.deleteVariable = function(variable, langArr){
    var key = variable.id || variable.name;
    if (!key) {
        return;
    }
    var langs = langArr || this._languages;
    for (var i = 0; i < langs.length; i++) {
        var lang = langs[i];
        var current = this._store[lang];
        if (Array.isArray(current)) {
            this._store[lang] = _.reject(current, function(item){
                return (item.id && item.id === variable.id) || (item.name && item.name === variable.name);
            });
        } else if (current && Array.isArray(current.variables)) {
            current.variables = _.reject(current.variables, function(item){
                return (item.id && item.id === variable.id) || (item.name && item.name === variable.name);
            });
        }
    }
};

DataStore.prototype.getAll = function(){
    return this._store;
};

var instance;

module.exports = {
    getInst: function(){
        if (!instance) {
            instance = new DataStore();
        }
        return instance;
    }
};
