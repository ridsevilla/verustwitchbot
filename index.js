// initialize config
var { verusdRpcIp, verusdRpcPort,
      verusdRpcUser, verusdRpcPass,
      verusdSenderAddress,
      twitchChannel, twitchUsername, twitchOauthToken } = require('./config.json');
twitchChannel = twitchChannel.toLowerCase();
twitchUsername = twitchUsername.toLowerCase();
var verusdRpcAuth = 'Basic ' + Buffer.from(verusdRpcUser + ':' + verusdRpcPass).toString('base64');

// initialize database
const sqlite3 = require('sqlite3');
const viewers_db = new sqlite3.Database('./viewers.db');
viewers_db.run("CREATE TABLE IF NOT EXISTS viewers (userid TEXT, username TEXT, vrsc_address TEXT, vrsc_status INT, updated_at TEXT)", [], (err) => {
  if (err) {
    console.log(err.message);
  }
});

// initialize twitch client
const tmi = require('tmi.js');
const twitchClient = new tmi.Client({
        options: { debug: false },
        connection: {
                secure: true,
                reconnect: true
        },
        identity: {
                username: twitchUsername,
                password: twitchOauthToken
        },
        channels: [ twitchChannel ]
});
twitchClient.connect().then((data) => {}).catch((err) => {});
twitchClient.on('message', (channel, tags, message, self) => {
  if (self) return;
  var username = tags.username;
  var userid = tags['user-id'];
  processMessage(channel, message, username, userid);
});

const BigNumber = require('bignumber.js');
const http = require('http');
const https = require('https');

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const rawToVerus = (amount) => {
  var multRaw = new BigNumber(0.00000001);
  var verus = multRaw.times(amount);
  return parseFloat(verus.toFixed());
}

const getTwitchChatters = (channel) => {
  if (channel.startsWith('#')) {
    channel = channel.substr(1);
  }
  var chatters = [];
  var rest_options = {
    host: 'gql.twitch.tv',
    port: 443,
    path: '/gql',
    method: 'POST',
    headers: {
      'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko'
    }
  }
  var post_data = {
    operationName: 'ChatViewers',
    variables: {
        channelLogin: channel
        },
    extensions: {
        persistedQuery: {
            version: 1,
            sha256Hash: 'e0761ef5444ee3acccee5cfc5b834cbfd7dc220133aa5fbefe1b66120f506250'
            }
        }
  }
  return new Promise ((resolve, reject) => {
    var request = https.request(rest_options, (response) => {
      var content = "";
      response.on('data', function(chunk) {
        content += chunk;
      });
      response.on('end', function() {
        try {
          let data = JSON.parse(content);
          if (data.data.channel.chatters.staff !== undefined) {
            data.data.channel.chatters.staff.forEach(function(staff) {
              chatters.push(staff.login);
            });
          }
          if (data.data.channel.chatters.moderators !== undefined) {
            data.data.channel.chatters.moderators.forEach(function(moderator) {
              chatters.push(moderator.login);
            });
          }
          if (data.data.channel.chatters.vips !== undefined) {
            data.data.channel.chatters.vips.forEach(function(vip) {
              chatters.push(vip.login);
            });
          }
          if (data.data.channel.chatters.viewers !== undefined) {
            data.data.channel.chatters.viewers.forEach(function(viewer) {
              chatters.push(viewer.login);
            });
          }
          resolve(chatters);
          return;
        }
        catch(error) {
          reject('invalid response from api server');
          return;
        }
      });
    });
    request.write(JSON.stringify(post_data));
    request.on('error', function(error) {
      reject('error while calling api endpoint');
    });
    request.end();
  });
}

const getVerusIdentityAddress = (name) => {
  var rest_options = {
    host: verusdRpcIp,
    port: verusdRpcPort,
    path: '/',
    method: 'POST',
    headers: {
      'Authorization': verusdRpcAuth
    }
  }
  var post_data = {
    'jsonrpc': '1.0',
    'id': 'api-rpc',
    'method': 'getidentity',
    'params': [ name ]
  }
  return new Promise ((resolve, reject) => {
    var request = http.request(rest_options, (response) => {
      var content = "";
      response.on('data', function(chunk) {
        content += chunk;
      });
      response.on('end', function() {
        if (content.startsWith('<')) {
          reject('invalid response from api server');
          return;
        }
        var data = JSON.parse(content);
        if (data.result != undefined && data.result.identity.identityaddress != undefined) {
          resolve(data.result.identity.identityaddress);
        }
        else {
          resolve(false);
        }
      });
    });
    request.write(JSON.stringify(post_data));
    request.on('error', function(error) {
      reject('error while calling rpc endpoint');
    });
    request.end();
  });
}

const getVerusBalance = (address) => {
  var rest_options = {
    host: verusdRpcIp,
    port: verusdRpcPort,
    path: '/',
    method: 'POST',
    headers: {
      'Authorization': verusdRpcAuth
    }
  }
  var post_data = {
    'jsonrpc': '1.0',
    'id': 'api-rpc',
    'method': 'getaddressbalance',
    'params': [
      { 'addresses': [ address ] }
    ]
  }
  return new Promise ((resolve, reject) => {
    var request = http.request(rest_options, (response) => {
      var content = "";
      response.on('data', function(chunk) {
        content += chunk;
      });
      response.on('end', function() {
        if (!content.startsWith('{')) {
          reject('invalid response from rpc server');
          return;
        }
        var data = JSON.parse(content);
        if (data.result != undefined && data.result.balance != undefined) {
          resolve(rawToVerus(data.result.balance));
        }
        else {
          reject("balance could not be retrieved");
        }
      });
    });
    request.write(JSON.stringify(post_data));
    request.on('error', function(error) {
      reject('error while calling rpc endpoint');
    });
    request.end();
  });
}

const getVerusOpStatus = (opId) => {
  var rest_options = {
    host: verusdRpcIp,
    port: verusdRpcPort,
    path: '/',
    method: 'POST',
    headers: {
      'Authorization': verusdRpcAuth
    }
  }
  var post_data = {
    'jsonrpc': '1.0',
    'id': 'api-rpc',
    'method': 'z_getoperationstatus',
    'params': [ [ opId ] ]
  }
  return new Promise ((resolve, reject) => {
    var request = http.request(rest_options, (response) => {
      var content = "";
      response.on('data', function(chunk) {
        content += chunk;
      });
      response.on('end', function() {
        if (!content.startsWith('{')) {
          reject('invalid response from rpc server');
          return;
        }
        var data = JSON.parse(content);
        if (data.result[0] != undefined && data.result[0].status != undefined) {
          resolve(data.result[0].status);
        }
        else {
          reject("status could not be retrieved");
        }
      });
    });
    request.write(JSON.stringify(post_data));
    request.on('error', function(error) {
      reject('error while calling rpc endpoint');
    });
    request.end();
  });
}

const sendVerus = (source, address, quantity) => {
  var rest_options = {
    host: verusdRpcIp,
    port: verusdRpcPort,
    path: '/',
    method: 'POST',
    headers: {
      'Authorization': verusdRpcAuth
    }
  }
  var post_data = {
    'jsonrpc': '1.0',
    'id': 'api-rpc',
    'method': 'sendcurrency',
    'params': [ source, [ {
      'currency': 'vrsc',
      'address': address,
      'amount': quantity } ]
    ]
  }
  return new Promise ((resolve, reject) => {
    var request = http.request(rest_options, (response) => {
      var content = "";
      response.on('data', function(chunk) {
        content += chunk;
      });
      response.on('end', function() {
        if (!content.startsWith('{')) {
          reject('invalid response from rpc server');
          return;
        }
        var data = JSON.parse(content);
        if (data.result != undefined) {
          (async() => {
            try {
              let status = await getVerusOpStatus(data.result);
              if (status == 'executing' || status == 'success')
                resolve('success');
              else
                reject('insufficient funds');
            }
            catch (error) {
              reject("status could not be retrieved");
            }
          })();
        }
        else {
          reject("status could not be retrieved");
        }
      });
    });
    request.write(JSON.stringify(post_data));
    request.on('error', function(error) {
      reject('error while calling rpc endpoint');
    });
    request.end();
  });
}

const sendVerusMultiple = (source, addresses, quantity) => {
  var rest_options = {
    host: verusdRpcIp,
    port: verusdRpcPort,
    path: '/',
    method: 'POST',
    headers: {
      'Authorization': verusdRpcAuth
    }
  }
  var transactions = [];
  for (var i = 0; i < addresses.length; i++) {
    transactions.push({ 'currency': 'vrsc', 'address': addresses[i], 'amount': quantity });
  }
  var post_data = {
    'jsonrpc': '1.0',
    'id': 'api-rpc',
    'method': 'sendcurrency',
    'params': [ source, transactions ]
  }
  return new Promise ((resolve, reject) => {
    var request = http.request(rest_options, (response) => {
      var content = "";
      response.on('data', function(chunk) {
        content += chunk;
      });
      response.on('end', function() {
        if (!content.startsWith('{')) {
          reject('invalid response from rpc server');
          return;
        }
        var data = JSON.parse(content);
        if (data.result != undefined) {
          (async() => {
            try {
              let status = await getVerusOpStatus(data.result);
              if (status == 'executing' || status == 'success')
                resolve('success');
              else
                reject('insufficient funds');
            }
            catch (error) {
              reject("status could not be retrieved");
            }
          })();
        }
        else {
          reject("status could not be retrieved");
        }
      });
    });
    request.write(JSON.stringify(post_data));
    request.on('error', function(error) {
      reject('error while calling rpc endpoint');
    });
    request.end();
  });
}

const setVerusAddress = (userid, username, address) => {
  return new Promise ((resolve, reject) => {
    (async () => {
      try {
        var valid = 0;
        if (address.endsWith('@')) {
          let status = await getVerusIdentityAddress(address);
          if (status !== false)
            valid = 1;
        }
        else {
          let balance = await getVerusBalance(address);
          if (balance !== false)
            valid = 1;
        }
        if (valid == 1) {
          viewers_db.serialize(() => {
            viewers_db.get("SELECT * FROM viewers WHERE userid = ?", [userid], (err,row) => {
              if (row === undefined) {
                viewers_db.run("INSERT INTO viewers(userid,username,vrsc_address,vrsc_status,updated_at) VALUES(?,?,?,?,datetime('now'))", [userid, username, address, 1], (err) => {
                  if (err) {
                    reject(err.message);
                  }
                  else {
                    resolve("success");
                  }
                });
              }
              else {
                viewers_db.run("UPDATE viewers SET username = ?, vrsc_address = ?, updated_at = datetime('now') WHERE userid = ?", [username, address, userid], (err) => {
                  if (err) {
                    reject(err.message);
                  }
                  else {
                    resolve("success");
                  }
                });
              }
            });
          });
        }
        else {
          reject("VRSC address is not valid or does not exist");
        }
      }
      catch (error) {
        reject("VRSC address is not valid or does not exist");
      }
    })();
  });
}

const getVerusAddressByUsername = (username) => {
  return new Promise ((resolve, reject) => {
    viewers_db.get("SELECT * FROM viewers WHERE username = ?", [username], function(err,row) {
      if (row === undefined) {
        resolve(false);
      }
      else {
        if (row.vrsc_address != undefined) {
          resolve(row.vrsc_address);
        }
        else {
          resolve(false);
        }
      }
      if (err) {
        reject(err.message);
      }
    });
  });
}

const processVerusRain = (channel, username, amount) => {
  return new Promise (async (resolve, reject) => {
    let chatters = await getTwitchChatters(channel);
    if (chatters.length > 0) {
      var chatterSql = 'SELECT * FROM viewers WHERE username IN ( ' + chatters.map(d => `'${d}'`).join() + ' )';
    }
    else {
      resolve('no valid, active viewers found');
      return;
    }
    viewers_db.all(chatterSql, [], function(err,rows) {
      if (rows === undefined) {
        resolve('no valid, active viewers found');
      }
      else {
        var addresses = [];
        for (var i = 0; i < rows.length; i++) {
          addresses.push(rows[i].vrsc_address);
        }
        var split = amount / addresses.length;
        try {
          (async() => {
            let status = await sendVerusMultiple(verusdSenderAddress, addresses, split);
            resolve(roundSplit(split) + ' VRSC sent to each valid, active viewer');
          })();
        }
        catch (error) {
          reject(error);
        }
      }
      if (err) {
        reject('database is unresponsive');
      }
    });
  });
}

const roundSplit = (split) => {
  if (split >= 0.1) {
    return Math.floor(split * 100) / 100;
  }
  else if (split < 0.1) {
    var zeroes = -Math.floor( Math.log(split) / Math.log(10) + 1);
    var multiplier = 100 * Math.pow(10, zeroes);
    return Math.floor(split * multiplier) / multiplier;
  }
}

const processMessage = (channel, message, username, user_id) => {
  if (message.startsWith('$') || message.startsWith('!'))
    message = message.substr(1);
  else
    return;

  if (message.startsWith('v ')) {
    if (twitchChannel != username)
      return;
    var amount = parseFloat(message.split(' ')[1]);
    if (amount < 0.001 || isNaN(amount)) {
      twitchClient.say(channel, username + ', amount has to be at least 0.001');
      return;
    }
    var address = message.split(' ')[2];
    if (address == null) {
      twitchClient.say(channel, '@' + username + ' recipient is required');
      return;
    }
    (async() => {
      try {
        var recipient = address;
        if (address.startsWith('@')) {
          recipient = address.substr(1);
        }
        recipient = recipient.toLowerCase();
        let verusAddress = await getVerusAddressByUsername(recipient);
        if (verusAddress == false) {
          twitchClient.say(channel, '@' + username + ' no VRSC address is set');
          return;
        }
        var status = await sendVerus(verusdSenderAddress, verusAddress, amount);
        twitchClient.say(channel, amount + ' VRSC sent to ' + address);
      }
      catch (error) {
        twitchClient.say(channel, '@' + username + ' ' + error);
      }
    })();
    return;
  }
  else if (message.startsWith('vrain ') || message.startsWith('vrian ')) {
    if (twitchChannel != username)
      return;
    var amount = parseFloat(message.split(' ')[1]);
    if (amount < 0.001 || isNaN(amount)) {
      twitchClient.say(channel, '@' + username + ' amount has to be at least 0.001');
      return;
    }
    (async() => {
      try {
        let balance = await getVerusBalance(verusdSenderAddress);
        if (parseFloat(amount) <= parseFloat(balance)) {
          let reply = await processVerusRain(channel, username, amount);
          twitchClient.say(channel, '@' + username + ' ' + reply);
        }
        else {
          twitchClient.say(channel, '@' + username + ' insufficient funds');
        }
      }
      catch (error) {
        twitchClient.say(channel, '@' + username + ' ' + error);
      }
    })();
    return;
  }
  else if (message == 'vrsc' || message == 'va') {
    (async() => {
      try {
        let address = await getVerusAddressByUsername(username);
        if (address == false) {
          twitchClient.say(channel, '@' + username + ' no VRSC address is set');
          return;
        }
        else {
          twitchClient.say(channel, '@' + username + ' VRSC address is set to ' + address);
        }
      }
      catch (error) {
        twitchClient.say(channel, '@' + username + ' database is unresponsive');
      }
    })();
    return;
  }
  else if (message.startsWith('vrsc ') || message.startsWith('va ')) {
    var address = message.split(' ')[1];
    if (address == null) {
      twitchClient.say(channel, '@' + username + ' VRSC address is required');
      return;
    }
    (async() => {
      try {
        let setAttempt = await setVerusAddress(user_id, username, address);
        twitchClient.say(channel, '@' + username + ' VRSC address is set');
      }
      catch (error) {
        twitchClient.say(channel, '@' + username + ' ' + error);
      }
    })();
    return;
  }
}
