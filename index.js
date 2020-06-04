var http = require("http");
var https = require("https");
var qs = require("querystring");
var requestLib = require("request");
var bridge;
var preconfig = require('./config');
var usermap = require('./usermap');
var Cli = require("matrix-appservice-bridge").Cli;
var Bridge = require("matrix-appservice-bridge").Bridge;
var AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;

class RyverHandler {
    constructor(username, password, usermap) {
	this._basic = 'Basic ' + btoa(username + ":" + password);
	this._bridged_users = [];  // Matrix users
	this._all_users = [];      // All relevant Ryver users, including bridged users
	this._bridged_teams = [];  // Relevant Ryver teams

	// Get Ryver user ids for matrix users
	for (user in usermap) {
	    this.bridged_users.push(user.ryver_userid);
	}

	console.log("Downloading data from Ryver....");

	// Figure out which Ryver teams we want
	for (user in this._bridged_users) {
	    user.teams = [];
	    var teams = this.getRyverData("/api/1/odata.svc/users(id=" + user + ")/workrooms");
	    for(team in teams){
		user.teams.push(team.id);
		this._bridged_teams.push(team.id);
	    }
	}
	this._bridged_teams = dedup(this._bridged_teams); // Remove duplicates

	// Get user data from teams we care about
	for (team in this._bridged_teams) {
	    // Create room for team if it doesn't exits
	    bridge.getIntent().createRoom({
		room_alias_name: "ryver_" + team.id
	    });
	    team.users = [];
	    var users = this.getRyverData("/api/1/odata.svc/workrooms(" + team + ")/members?$expand=member");
	    for (user in users) {
		this._all_users.push(user.member);
		team.users.push(user.member.id);
		bridge.getIntent(this.user('ryver_userid', user.member.id).matrix_localpart).join("ryver_"+team.id)
	    }
	    team.users = dedup(team.users);	    
	}
	this._all_users = dedup(this._all_users);

	console.log("Done.");
    }

    getRyverData(endpoint) {
	var opts = {
	    hostname: preconfig.ryver_url + endpoint,
	    headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/json',
		'Authorization': this._basic
	    }
	};
	
	https.get(opts, resp => {
	    var data = "";
	    var ret = "";
	    resp.on('data', chunk => {
		data += chunk;
	    });

	    resp.on('end', _ => {
		ret = JSON.parse(data).d.results;
	    });
	}).on("error", err => {
	    console.log("Error: " + err.message);
	});

	return ret;
    }
    
    get teams() {
	return this._bridged_teams;
    }

    get team(id) {
	return this._bridged_teams.find(i => i.id === id);
    }

    get users() {
	return this._all_users;
    }

    get user(attribute, value) {
	return this._all_users.find(i => eval("i." + attribute) === value);
    }

    sendMessage(user, text, room) {
	user = this.user(id, user);
	var opts = {
	    hostname: preconfig.ryver_url + "/api/1/odata.svc/workrooms(" + room + ")/Chat.PostMessage()",
	    headers: {
		'Accept': 'application/json',
		'Content-Type': 'application/json',
		'Authorization': this._basic
	    }
	};
	request.post(opts,
	    json: {
		"createSource": {
		    "avatar": user.avatar,
		    "username": user.username,
		    "displayName": user.displayName
		},
		"body": text
	    }, (error, res, body) => {
		 if (error) {
		     console.error(error);
		     return;
		 }
		 console.log("Message posted to Ryver");
		 console.log(body);
	    }
	});	
    }

	
}

function dedup(arr) {
    return Array.from(new Set(arr));
}

var ryver = new RyverHandler(config.ryver_un, config.ryver_pw, usermap);

http.createServer((req, resp) => {
    console.log(req.method + " " + req.url);

    var body = "";
    req.on("data", chunk => {
	body += chunk;
    });

    req.on("end", _ => {
	console.log(body);
	var params = qs.parse(body);
	if (params.type == "chat_created") {
	    var un = ryver.user('displayName', params.user.__descriptor).username;
	    var intent = bridge.getIntent("@ryver_" + un + ":" + preconfig.domain);
	    intent.sendMessage("@ryver_" + params.data.channel.id, params.data.entity.message);
	}
	resp.writeHead(200, {"Content-Type": "application/json"});
	resp.write(JSON.stringify({}));
	resp.end();
    });

}).listen(config.port);

new Cli({
    registrationPath: "ryver-registration.yaml",
    generateRegistration: (reg, callback) => {
	reg.setId(AppServiceRegistraion.generateToken());
	reg.setHomeserverToken(AppServiceRegistraion.generateToken());
	reg.setAppServiceToken(AppServiceRegistration.generateToken());
	reg.setSenderLocalpart("ryverbot");
	reg.addRegexPattern("users", "@ryver_.*", true);
	reg.addRegexPattern("rooms", "!ryver_.*", true);
	reg.addRegexPattern("aliases", "#ryver_.*", true);
	callback(reg);
    },
    run: (port, config) => {
        bridge = new Bridge({
	    homeserverUrl: preconfig.homeserverUrl,
	    domain: preconfig.domain,
	    registration: "ryver-registration.yaml",
	    controller: {
		onUserQuery: queriedUser => {
		    un = queriedUser.localpart.substring(7);
		    name = ryver.user("username", un).displayName;
		    return {
			name: name
		    }; // auto-create matrix user with display name from Ryver
		},
		onEvent: (request, context) => {
		    var event = req.getData();
		    if (event.type !== "m.room.message" || !event.content) {
			return;
		    }
		    ryver.sendMessage(event.user_id);
		}
	    }
	});
	console.log("Matrix listening for Ryver webhooks on port %s", port);
	bridge.run(port, config);
    }
}).run();

