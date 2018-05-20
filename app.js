//load the config params
var config = require('config.json')('./config.json');

//use web socket to connect to a blockchain network
var WebSocket = require('ws');
var ws = new WebSocket(config.ws_server_url);
console.log ('Listening to web socket' + config.ws_server_url);

//salesforce api library
var nforce = require('nforce');

//handle incoming message
ws.on('message', function(message) {
  console.log('Received: ' + message);
  var eventMessage = JSON.parse(message);
  console.log(eventMessage.individualId);

  //using OAuth username/password flow to authenticate to Salesforce
  var org = nforce.createConnection( {
    clientId: config.oauth.clientId,
    clientSecret: config.oauth.clientSecret,
    redirectUri: config.oauth.redirectUri,
    environment: config.oauth.environment,
    mode: config.oauth.mode
  });

  org.authenticate({ username: config.username, password: config.password}, function(err, resp) {
    if (!err) {

      //first query if the candidate exists, if so log a case
      var q = 'SELECT Id, Name FROM Candidate__c WHERE Government_ID__c = \'' + eventMessage.individualId + '\' LIMIT 1';
      org.query( { query: q}, function(err, resp) {
        if (!err) {
          if (resp.records && resp.records.length > 0) {
            var candidate = resp.records[0];

            var _case = nforce.createSObject(config.sfdc_case_entity.name);
            _case.set('Origin', config.sfdc_case_entity.origin);
            _case.set('Status', config.sfdc_case_entity.status);
            _case.set('OwnerId', config.sfdc_case_entity.owner_id);
            _case.set('Subject', candidate.get('Name') + ' background check failed');
            _case.set('Description', eventMessage.description);
            org.insert({ sobject: _case }, function(err, resp){
              if(!err) console.log('Created case: ' + resp.id);
            });
          }
        }});
    }
  })
});

ws.on('close', function(code) {
  console.log('Disconnected: ' + code);
});

ws.on('error', function(error) {
  console.log('Error: ' + error.code);
});
