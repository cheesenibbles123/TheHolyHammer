const config = require("./config.json");
const Discord = require("discord.js");
const bot = new Discord.Client();

const FTP = require('ftp');
const fetch = require("node-fetch");
const datafile = require("./datafile.json");
const mysql = require("mysql");
const btoa = require('btoa');
const ytdl = require('ytdl-core');
const fs = require('fs');

var mainDatabaseConnectionPool = mysql.createPool({
	connectionLimit : 30,
	host : config.databaseInfo.host,
	user : config.databaseInfo.user,
	password : config.databaseInfo.password,
	database : config.databaseInfo.database
});

var logEverySingleEvent = false;

const serverRoles = {
	"moderator" : "626871464309817394",
	"administrator" : "626871388799500288"
}

const connectionInfo = {
	"host": config.ftpSetup.host,
  	"user": config.ftpSetup.user,
  	"password":config.ftpSetup.password
}

var isPlaying = false;

var currentDispatcher = null;

const leaderboardlimits = {
	"listsizelimit" : 30,
	"rank" : 2,
	"username" : 16,
	"level" : 7,
	"xp" : 10
}

var invites = {};


function initInviteCount(){
	let g = bot.guilds.get("626871238752731146");
	g.fetchInvites().then(guildInvites => {
      invites[g.id] = guildInvites;
    });

    var initCon = mysql.createConnection({
		host : mysqlLoginData.host,
		user : mysqlLoginData.user,
		password : mysqlLoginData.password,
		database : mysqlLoginData.database,
	});

	initCon.connect(err => {
		if(err) console.log(err);
	});

	initCon.query(`SELECT * FROM hammerbotInvites order by invite_count desc`, (err,rows)=> {
		if (rows.length > 0){
			let inviteMsg = "```\n";
			for (i=0;i < 30;i++){
				let username = "";
				try{
					username = bot.fetchUser(`'${rows[i].member_id}'`).username;
				}catch(e){
					username = rows[i].member_id;
				}
				inviteMsg = inviteMsg + `${username} : ${rows[i].invite_count}\n`;
			}
			inviteMsg = inviteMsg +"```";
			bot.channels.get("626938520090443776").fetchMessage("695582294882123846").then(msg => {
				msg.edit(inviteMsg);
			});
		}
	});
}

function updateInviteCount(member){
	member.guild.fetchInvites().then(guildInvites => {
    // This is the *existing* invites for the guild.
   		const ei = invites[member.guild.id];
    // Update the cached invites for the guild.
    	invites[member.guild.id] = guildInvites;
    // Look through the invites, find the one for which the uses went up.
    	const invite = guildInvites.find(i => ei.get(i.code).uses < i.uses);
    // This is just to simplify the message being sent below (inviter doesn't have a tag property)
    	//const inviter = client.users.get(invite.inviter.id);
    	updateDBInviteCount(invite.inviter.id);
  	});
}

function updateDBInviteCount(ID){

	mainDatabaseConnectionPool.query(`SELECT * FROM hammerbotInvites where member_id=${ID}`, (err,rows)=> {
		if (rows.length < 1){
			inviteCon.query(`insert into hammerbotInvites (member_id,invite_count) values (${ID},1)`);
		}else{
			inviteCon.query(`update hammerbotInvites set invite_count=${rows[0].invite_count + 1} where member_id=${member_id}`)
		}
	});
}
//Get User

function getUserFromMention(mention) {
	var matches = mention.match(/^<@!?(\d+)>$/);
	if (!matches) return;
	var id = matches[1];
	return bot.users.get(id);
}

//randomint
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
};

//FTP
function streamToString(stream, cb) {
  const chunks = [];
  stream.on('data', (chunk) => {
    chunks.push(chunk.toString());
  });
  stream.on('end', () => {
    cb(chunks.join(''));
  });
}

//leaderboard
function updateleaderboard(){
	let delay = 30000;
	var interval = setInterval(function(){
		mainDatabaseConnectionPool.query(`SELECT * FROM hammerxp`, (err,rows) =>{
			rows = sortingrows(rows);
			let length = 0;
			if (rows.length<leaderboardlimits.listsizelimit){
				length = rows.length;
			}else{
				length = leaderboardlimits.listsizelimit; 
			}
			let finalmsg = "```diff\n"
							+"-XP LeaderBoard\n"
							+"+Rank  Username          level     XP\n";
			for (i=0;i<length;){
				let rank = (i+1).toString();
				if (rank.length > leaderboardlimits.rank){
					conosle.log("EXPAND SIZE");
				}else{
					let x = leaderboardlimits.rank - rank.length;
					rank = rank + new Array(x + 1).join(' ');
				}
				let user;
				let username = "";
				try{
					user = bot.users.get(rows[i].id);
					username = user.username;
				}catch(e){
					username = rows[i].id;
				}
				if (username.length > leaderboardlimits.username){
					username = username.slice(0,leaderboardlimits.username);
				}else{
					let x = leaderboardlimits.username - username.length;
					username = username + new Array(x + 1).join(' ');
				}
				let level = rows[i].level.toString();
				if (level.length > leaderboardlimits.level){
					level.slice(0,leaderboardlimits.level);
				}else{
					let x = leaderboardlimits.level - level.length;
					level = level + new Array(x + 1).join(' ');
				}
				let xp = rows[i].xp.toString();
				if (xp.length > leaderboardlimits.xp){
					score.slice(0,leaderboardlimits.xp);
				}else{
					let x = leaderboardlimits.xp - xp.length;
					xp = xp + new Array(x + 1).join(' ');
				}
				finalmsg = finalmsg + `${rank} | ${username} | ${level} | ${xp}\n`
				i++;
			}
			finalmsg = finalmsg+"```";
			bot.channels.get("699309453941538946").fetchMessage("699309521016717344").then(msg => {msg.edit(finalmsg);});
		});
	},delay);
}

function sortingrows(rows){
	for (var i = 1; i < rows.length; i++){
    	for (var j = 0; j < i; j++){
       		if (parseInt(rows[i].level) < parseInt(rows[j].level)){
    	    var x = rows[i];
    	   	rows[i] = rows[j];
    	   	rows[j] = x;
    		}
    	}
	}
	for (var i = 1; i < rows.length; i++){
    	for (var j = 0; j < i; j++){
       		if ((parseInt(rows[i].level) === parseInt(rows[j].level)) & (parseInt(rows[i].xp) < parseInt(rows[j].xp))){
    	    var x = rows[i];
    	   	rows[i] = rows[j];
    	   	rows[j] = x;
    		}
    	}
	}
	return rows.reverse();
}

//levels
function checklevels(message,level){
	if (level === 1){
		message.member.addRole("627135670649094164");
	}else
	if (level === 5){
		message.member.removeRole("627135670649094164");
		message.member.addRole("627135717218189346");
	}else
	if (level === 10){
		message.member.removeRole("627135717218189346");
		message.member.addRole("627135751720534016");
	}else
	if (level === 15){
		message.member.removeRole("627135751720534016");
		message.member.addRole("627135793479024651");
	}else
	if (level === 20){
		message.member.removeRole("627135793479024651");
		message.member.addRole("627135837901160458");
	}
}

function levelsystem(xp,currentlevel){
	if (currentlevel === 0 & xp > 400){
		return true;
	}else{
		let lvlupxp = currentlevel*800;
		if ( xp >= lvlupxp){
			return true;
		}else{
			return false;
		}
	}
}

function genXp(){
	return Math.floor(Math.random()*(15+5+1))+15;
}

//blackwake server browser
function updateserverlist(){
	var interval = setInterval(function(){
  		fetch(`https://api.steampowered.com/IGameServersService/GetServerList/v1/?key=${config.apiKeys.steam}&format=json&filter=\\appid\\420290`).then(res=>res.json()).then(resp=>{ //fetch the server list through the steam API, convert the result into a json object (makes it easier to access)
    		let serverlist = resp.response.servers;
    		if (typeof serverlist === undefined){
      			console.log("Got an empty response");
    		}else{
      			finalServerList = "```markdown\n";
      			finalServerStatus = "```markdown\n";

      			let active = new Array();
      			for (i in serverlist){
        			if(parseInt(serverlist[i].players) > 0){
        				active.push(serverlist[i]);
        			}
        			if (serverlist[i].name.toString() === "|3.9|a |EU| The Holy Hammers d::wHJPqYm"){
      					finalServerStatus = finalServerStatus + `Name: ${serverlist[i].name.split("d::")[0].replace(/]/g,"\\").substr(7)}\nPlayers: ${serverlist[i].players}/${serverlist[i].max_players}\nPassworded: ${serverlist[i].secure}\n\n`;
      				}
      			}
      			let numServersAdded = 0;
      			active = serversort(active);
      			for (i in active){
      				if (finalServerList.length < 1930){
      					numServersAdded = numServersAdded + 1;
       			 		serverinfo = `[${active[i].players}/${active[i].max_players}][${active[i].name.split("d::")[0].replace(/]/g,"\\").substr(7)}]\n`;
        				finalServerList = finalServerList + serverinfo;
        			}
      			}
      			if (finalServerList.length >= 1930){
        			finalServerList = finalServerList + `\n< Displaying ${numServersAdded}/${active.length} >`;
        		}
      			finalServerList = finalServerList.replace(/discord\.gg/g,"disc.gg") + "```";
      			finalServerStatus = finalServerStatus + "```";
      			bot.channels.get("660578877273276417").fetchMessage("676764826495746058").then(msg => {msg.edit(finalServerList);});
    		}
  		});
  	},6000);
}

function serversort(servers){
	for (var i = 1; i < servers.length; i++){
    	for (var j = 0; j < i; j++){
       		if (parseInt(servers[i].players) < parseInt(servers[j].players)){ //if there are less players in the left server, then swap them (basic sorting algorithm using two for loops)
    	    	var x = servers[i];
    	   		servers[i] = servers[j];
    	   		servers[j] = x;
    		}
    	}
	}
	return servers.reverse(); //return the sorted array
}

//SCIENCE FUNCTIONS
function ISSLocation(){
	fetch("http://api.open-notify.org/iss-now.json").then(res => res.json()).then(response => {
		let date = new Date(response.timestamp * 1000);
		date = date.toString().replace(/T/g," ");
		date = date.replace(/Z/g,"");
		let ISSembed = new Discord.RichEmbed()
					.setTitle("ISS Location")
					.setDescription(`LAT: ${response.iss_position.latitude}\nLON: ${response.iss_position.longitude}`)
					.setFooter(`Date: ${date}`)
					.setTimestamp();
		bot.channels.get("669604392785412104").fetchMessage("669605349854150686").then(msg => { msg.edit(ISSembed);});
	})
}
function covidAPI(){
	fetch(`https://api.covid19api.com/summary`).then(resp=>resp.json()).then(response => {
		let coronaApi = new Discord.RichEmbed()
			.setTitle(`COVID-19 INFO`)
			.setDescription(`New Confirmed: ${response.Global.NewConfirmed}\nTotal Confirmed: ${response.Global.TotalConfirmed}\nNew Deaths: ${response.Global.NewDeaths}\nTotal Deaths: ${response.Global.TotalDeaths}\nNew Recovered: ${response.Global.NewRecovered}\nTotal Recovered: ${response.Global.TotalRecovered}`)
			.setTimestamp();
		bot.channels.get("669604392785412104").fetchMessage("697510085580030045").then(msg =>{
			msg.edit(coronaApi);
		});
	});
}

//MEME FUNCTIONS
async function yodish(message,args){
	let conversion = encodeURIComponent(args.join(" "));
	let resp = await fetch(`http://yoda-api.appspot.com/api/v1/yodish?text=${conversion}`).then(response => response.json()).then(result =>{
		return result;
	});;
 	message.channel.send(resp.yodish);
}

//BAZING SAILS WIKI INFOR
function getWikiInfo(message,args){
	if (Array.isArray(args)){
		if (args[0].toLowerCase() === 'weapons'){
			fetch(`https://blazingsails.gamepedia.com/Category:Weapons`).then(res=>res.text()).then(response => {
				let globalList = response.split("<table");
				let rangedWeapons = globalList[1].split("<td><div class=");
				rangedWeapons = rangedWeapons.slice(0,rangedWeapons.length-1);
				let meleeWeapons = globalList[2].split("<td><div class=").slice(0,8);
				meleeWeapons[0] = meleeWeapons[0].split("</th>\n")[2];
				let found = false;

				//RANGED WEAPONS
				rangedWeapons.forEach(weapon => {
					let weaponStats = weapon.split("<td");
					if (typeof weaponStats[3] == undefined){
						console.log("error");
					}else{
						let stats = weaponStats[3].split("</b>");
						let name = weaponStats[1].substring(1,weaponStats[1].length - 7);
						if (args.slice(1).join(" ").toLowerCase() === name.toLowerCase()){
							let ammo = weaponStats[2].substring(1,weaponStats[2].indexOf("\n"));
							let dmg = stats[1].substring(1,stats[1].indexOf("\n"));
							let aoeDMG = stats[2].substring(1,stats[2].indexOf("\n"));
							let rof = stats[3].substring(1,stats[3].indexOf("\n"));
							let magSize = stats[4].substring(1,stats[4].indexOf("\n"));
							let rldTime = stats[5].substring(1,stats[5].indexOf("\n"));
							let prjSpd = stats[6].substring(1,stats[6].indexOf("\n"));
							let prjDrop = stats[7].substring(1,stats[7].indexOf("\n"));
							let WeaponEmbed = new Discord.RichEmbed()
								.setTitle(`${name}`)
								.setDescription(`Ammo: ${ammo}\nDamage: ${dmg}, AOE: ${aoeDMG}\nRate Of Fire: ${rof}\nMagazine Size: ${magSize}\nReload Time: ${rldTime}\nProjectile Speed: ${prjSpd}\nProjectile Drop: ${prjDrop}`)
								.setTimestamp();
							message.channel.send(WeaponEmbed);
							found = true;
						}
					}
				});

				//MELEE WEAPONS
				if (!found){
					meleeWeapons.forEach(weapon => {
						let weaponStats = weapon.split("<td");
						if (typeof weaponStats[2] == undefined){
							console.log("error");
						}else{
							let name = weaponStats[1].substring(1,weaponStats[1].length - 7);
							let stats = weaponStats[2].split("</b");
							if (args.slice(1).join(" ").toLowerCase() === name.toLowerCase()){
								let dmg = stats[1].substring(1,stats[1].indexOf("\n"));
								let attackSpd = stats[2].substring(1,stats[2].indexOf("\n"));
								let maxDps = stats[3].substring(1,stats[3].indexOf("\n"));
								let WeaponEmbed = new Discord.RichEmbed()
									.setTitle(`${name}`)
									.setDescription(`Damage: ${dmg}\nAttack Speed: ${attackSpd}\nMax DPS: ${maxDps}`)
									.setTimestamp();
								message.channel.send(WeaponEmbed);
								found = true;
							}
						}
					});
				}

				if (!found){
					message.reply(`Unable to find weapon **${args[1]}**, please make sure you spelt it correctly!`);
				}
			});
		}else
		if (args[0].toLowerCase() === 'resources'){
			fetch(`https://blazingsails.gamepedia.com/Category:Resources`).then(res=>res.text()).then(response => {
				globalInfo = response.split(`<div id="mw-content-text"`)[1].split(`</td></tr></tbody></table>`)[0];
				let found = false;
				if (args[1].toLowerCase() === 'wood'){
					let woodContent = globalInfo.split("<h2>")[2].split("<p>")[1].slice(0,globalInfo.split("<h2>")[2].split("<p>")[1].length - 5);
					let woodEmbed = new Discord.RichEmbed()
						.setTitle(`Wood`)
						.setDescription(`${woodContent}`)
						.setTimestamp();
					message.channel.send(woodEmbed);
					found = true;
				}else
				if (args.slice(1).join(" ").toLowerCase() === 'healing items'){
					let healingItems = globalInfo.split("<h2>")[3].split("<p>")[1].slice(0,globalInfo.split("<h2>")[3].split("<p>")[1].length - 5);
					let healingEmbed = new Discord.RichEmbed()
						.setTitle(`Healing Items`)
						.setDescription(`${healingItems}`)
						.setTimestamp();
					message.channel.send(healingEmbed);
					found = true;
				}else
				if (args.slice(1).join(" ").toLowerCase() === 'weapon ammo'){
					let list = globalInfo.split("<h2>")[4].split("<p>"); //[1].slice(0,globalInfo.split("<h2>")[3].split("<p>")[1].length - 5)
					let weaponAmmoEmbed = new Discord.RichEmbed()
						.setTitle(`Weapon Ammo`)
						.setDescription(`${list[1].slice(0,list[1].length-4)}`)
						.addField(`${list[2].split("<li>")[1].slice(0,list[2].split("<li>")[1].indexOf("</li>"))}`,`${list[3].slice(0,list[3].indexOf("\n"))}`,true)
						.addField(`${list[3].split("<li>")[1].slice(0,list[3].split("<li>")[1].indexOf("</li>"))}`,`${list[4].slice(0,list[4].indexOf("\n"))}`,true)
						.addField(`${list[4].split("<li>")[1].slice(0,list[4].split("<li>")[1].indexOf("</li>"))}`,`${list[5].slice(0,list[5].indexOf("\n"))}`,true)
						.setTimestamp();
					message.channel.send(weaponAmmoEmbed);
					found = true;
				}else{
					let globalList = response.split("<table")[1].split("</table>")[0].split("<div");
					globalList.forEach( shotType => {
						let info = shotType.split("<td>");
						if (typeof info[2] !== undefined && Array.isArray(info) && info.length > 2){
							let name = info[1].slice(0,info[1].indexOf("\n"));
							if (name.toLowerCase() === args.slice(1).join(" ").toLowerCase()){
								if (name.toLowerCase() === 'regular cannonball'){
									info[3] = `A regular cannonball is the only ammunation which is used for the swivel cannon, Shoulder cannon and Bomb launcher.\n</td>\n`
								}
								let shotTypeEmbed = new Discord.RichEmbed()
									.setTitle(`${name}`)
									.setDescription(`${info[3].replace(/<\/p>/g,"").replace(/<p>/g," - ").slice(0,info[3].indexOf("."))}.\n\nDrop Rate: ${info[2].slice(info[2].indexOf("</b>") + 5,info[2].length - 7)}`)
									.setTimestamp();
								message.channel.send(shotTypeEmbed);
								found = true;
							}
						}
					})
					//console.log(globalList);
					//let cannonShotTypes = globalList[1].split("<td><div class=");
				}

				if (!found){
					message.reply("Please make sure you have entered your query correctly!");
				}
			});
		}else
		if (args.slice(1).join(" ").toLowerCase() === 'shipupgrades'){
			message.reply("This category is not yet completed! :)");
		}else{
			message.reply("Currently only the `weapons`,`resources` categories are supported!");
		}
	}else{
		message.reply("Please make sure you have entered the category + item correctly!");
	}
}

function clean(text) {
    if (typeof(text) === "string"){
      return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));
  }
    else{
      return text;
    }
}

//BW SERVER COMMANDS (makes use of FTP)
function addMod(ID){
  	let client = new FTP();
  	client.connect({
  		"host":connectionInfo.host,
  		"user":connectionInfo.user,
  		"password":connectionInfo.password
  	});
  	client.append(`\nADDEDUSER=${ID}`,"/BW05573/Blackwake/Mod.txt",function(err){
  		if (err){
  			console.log(err);
  		}
  	});
  	client.end();
}

function removeMod(ID){
  	let client = new FTP();
  	client.connect({
  		"host":connectionInfo.host,
  		"user":connectionInfo.user,
  		"password":connectionInfo.password
  	});
  	client.get("/BW05573/Blackwake/Mod.txt",function(err,fileStream){
  		console.log("------------------------------------------");
  		streamToString(fileStream, (data) =>{
  			data = data.replace(`${ID}`,"");
  			client.put(data,"/BW05573/Blackwake/Mod.txt",function(err){
  				console.log("------------------------------------------");
  				console.log(err);
  			});
  		});
  	});
  	client.end();
}

function addBan(ID){
  	let client = new FTP();
  	client.connect({
  		"host":connectionInfo.host,
  		"user":connectionInfo.user,
  		"password":connectionInfo.password
  	});
  	client.get(`\nADDEDUSER=${ID}`,"/BW05573/Blackwake/bans.txt",function(err){
  		if (err){
  			console.log(err);
  		}
  	});
  	client.end();
}

function removeBan(ID){
  	let client = new FTP();
  	client.connect({
  		"host":connectionInfo.host,
  		"user":connectionInfo.user,
  		"password":connectionInfo.password
  	});
  	client.get("/BW05573/Blackwake/bans.txt",function(err,fileStream){
  		console.log("------------------------------------------");
  		streamToString(fileStream, (data) =>{
  			data = data.replace(`${ID}`,"");
  			client.put(data,"/BW05573/Blackwake/Mod.txt",function(err){
  				console.log("------------------------------------------");
  				console.log(err);
  			});
  		});
  	});
  	client.end();
}

function searchUsers(nameToSearch){
	let fullList = "";
	let client = new FTP();
  	client.connect({
  		"host":connectionInfo.host,
  		"user":connectionInfo.user,
  		"password":connectionInfo.password
  	});
  	client.list("/BW05573/Blackwake/BlackwakeServer_Data/Players", function(err,list){
  		if (err) throw err;
  		list.forEach(person => {
  			if (person.name.toLowerCase().includes(nameToSearch)){
  				client.get(`/BW05573/Blackwake/BlackwakeServer_Data/Players/${person.name}`,function(err,stream){
  					streamToString(fileStream, (data) =>{
  						fullList += data;
  					});
  				})
  			}
  		});
  	});
  	client.end();
  	console.log(fullList);
}

//BW SERVER LOGFILEUSAGE
function getBlackwakeServerLogFiles(){
	let getBlackwakeServerLogFilesClient = new FTP();
  	getBlackwakeServerLogFilesClient.connect({
  		"host":connectionInfo.host,
  		"user":connectionInfo.user,
  		"password":connectionInfo.password
  	});
  	getBlackwakeServerLogFilesClient.get("/BW05573/Blackwake/BlackwakeServer_Data/output_log.txt", function(err,stream){
  		stream.once('close',function() {
  			getBlackwakeServerLogFilesClient.delete("/BW05573/Blackwake/BlackwakeServer_Data/output_log.txt", function (err){
  				if (err) throw err;
  			});
  			getBlackwakeServerLogFilesClient.end();
  		} );
  		stream.pipe(fs.createWriteStream('output_log.txt'));
  		readBlackwakeServerLocalLogFiles();
  	});
}

function readBlackwakeServerLocalLogFiles(){
	let readline = require('readline');
	let readInterface = readline.createInterface({
	    input: fs.createReadStream('/path/to/file'),
	    output: process.stdout,
	    console: false
	});

	readInterface.on('line', function(line) {
	    if (line.startsWith('[')){
	    	blackwakeServerHandlers(line);
	    }else
	    if (line.startsWith('Getting players stats')){
	    	addPlayerToRecordedSteamIDs(line.split(" ")[3]);
	    }
	});

}

function blackwakeServerHandlers(line){
	let lineContents = line.split(']');
	let serverHandlersEmbed = new Disocrd.RichEmbed()
	.setTitle(`${linecontents[1]}`)
	.setDescription(`${lineContents[0].slice(1,lineContents[0].length)}`);
	bot.channels.get("641408290357641217").send(serverHandlersEmbed);
}

function addPlayerToRecordedSteamIDs(steamID){}

//LATEST UPDATE INFO FETCHER
function fetchLatestBlackwakeNews(){
	fetch(`http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=420290&count=1&maxlength=1700&format=json`).then(res=>res.json()).then(response => {
		let news = response.appnews.newsitems[0];
		let bsNews = new Discord.RichEmbed()
			.setTitle(`${news.title}`)
			.setDescription(`${news.contents}\n[Link To steam post](${news.url})`)
			.setImage("https://www.hrkgame.com/media/games/.thumbnails/header_4FcgG7r.jpg/header_4FcgG7r-460x215.jpg")
			.setFooter(`By ${news.author} on ${new Date( news.date * 1000)}`);
		bot.channels.get("700115214938669196").fetchMessage("700115937298481182").then(msg => {
			msg.edit(bsNews);
		});
	});
}
function fetchLatestBannerlordNews(){
	fetch(`http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=261550&count=1&maxlength=1700&format=json`).then(res=>res.json()).then(response => {
		let news = response.appnews.newsitems[0];
		let bsNews = new Discord.RichEmbed()
			.setTitle(`${news.title}`)
			.setDescription(`${news.contents}\n[Link To steam post](${news.url})`)
			.setImage("https://images.g2a.com/newlayout/323x433/1x1x0/073dcc29d466/5e3a7ade46177c1e96170ba2")
			.setFooter(`By ${news.author} on ${new Date( news.date * 1000)}`);
		bot.channels.get("700115214938669196").fetchMessage("700115954130223195").then(msg => {
			msg.edit(bsNews);
		});
	});
}
function fetchLatestBlazingSailsNews(){
	fetch(`http://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=1158940&count=1&maxlength=1700&format=json`).then(res=>res.json()).then(response => {
		let news = response.appnews.newsitems[0];
		let bsNews = new Discord.RichEmbed()
			.setTitle(`${news.title}`)
			.setDescription(`${news.contents}\n[Link To steam post](${news.url})`)
			.setImage("https://static.wixstatic.com/media/28c098_e0afa88d818149fdb8c0bd2fdcd3d035~mv2_d_2000_2394_s_2.png/v1/fill/w_975,h_1167,fp_0.50_0.50,q_95/28c098_e0afa88d818149fdb8c0bd2fdcd3d035~mv2_d_2000_2394_s_2.webp")
			.setFooter(`By ${news.author} on ${new Date( news.date * 1000)}`);
		bot.channels.get("700115214938669196").fetchMessage("700115963311292476").then(msg => {
			msg.edit(bsNews);
		});
	});
}

bot.on("ready" , () =>{
	console.log("Hammer ready");
	bot.user.setActivity("Hole Repair");

	//initInviteCount();
	//updateleaderboard();
	
	//setTimeout(function(){
	//	updateserverlist();
	//},1000);
	
	setInterval(() =>{
		ISSLocation();
	}, 10000);

	//Once a Day
	setTimeout(function(){
		fetchLatestBlackwakeNews();
		fetchLatestBannerlordNews();
		fetchLatestBlazingSailsNews();
	},86400000);
	setInterval(() =>{
		covidAPI();
	},86400000);
});

bot.on("guildMemberAdd", function(member){
	let welcomemsg = datafile.welcomes[getRandomInt(datafile.welcomes.length+1)];
	welcomemsg = welcomemsg.replace("TARGET",`${member}`);
	bot.channels.get("626899447053287424").send(welcomemsg+". Take a minute to check out <#640195863255449610>, and come say hi in <#626871238752731148>! If you have any issues head over to<#627132321279246337>.");
	member.addRole("626871646367514655");
	updateInviteCount(member);
});

bot.on("message", async message =>{
	if (message.author.bot) return;

	// N word filter
	if (message.content.toLowerCase().includes('nigger') || message.content.toLowerCase().includes(" "+"nigger"+" ")){
		if (message.channel.id === "640186188891684885"){
			message.react("669213847365877774");
		}else{
			message.delete();
			message.channel.send(message.author+" Please dont use that language!");
			bot.channels.get("626938520090443776").send("Message: "+message.content+" || has been deleted. Author: "+message.author.username);
			return;
		}
	}

	let num = getRandomInt(6);
	if (num === 2){
		if (message.content.toLowerCase().includes("hammer")){
			message.react("626899921827528732");
		}
		if (message.content.toLowerCase().includes("waffle")){
			message.react("627131505503764480");
		}
	}

	if (message.content.includes("<@626904421628117003>")){
		message.react("🤔");
	}else if (message.content.toLowerCase() === "!key"){
		message.channel.send("No 🙂.");
	}

	// Support ticket
	if (message.channel.id === "627132321279246337"){
		let content = message.content;
		message.guild.createChannel(message.author.username,"text",[
			{
				id : "626871238752731146",
				deny : ['VIEW_CHANNEL'],
			},
			{
				id : `${message.author.id}`,
				allow : ["VIEW_CHANNEL"],
			},
			{
				id : "626871464309817394",
				allow : ["VIEW_CHANNEL"],
			},
		]).then(channel => {
			channel.setParent("627134252391202831");
			channel.send("Query is: "+content+" - please wait for a member of staff to respond to your ticket.");
		});
		message.delete();
	}

	if (message.guild.id === "401924028627025920"){
		mainDatabaseConnectionPool.query(`SELECT * FROM hammerxp WHERE id = '${message.author.id}'`, (err,rows) => {
			if(err) console.log(err);
			let sql;
			if(rows.length < 1){
				sql = `INSERT INTO hammerxp VALUES ('${message.author.id}','${btoa(message.author.username)}', ${genXp()}, 0, '"n"')`;
				con.query(sql);
			} else {
				let eligible = rows[0].canget;
				if (eligible === '"y"'){
					let level = parseInt(rows[0].level);
					let newxp = parseInt(rows[0].xp) + genXp();
					let go = levelsystem(newxp,level);
					if (go) {
						level = level+1;
						newxp = 0;
						bot.channels.get("669597152565002260").send(`Congrats ${message.author}, you have leveled up! You're now level: ${level}`);
						console.log(`${message.author.username} has leveled up`);
					}
					sql = `UPDATE hammerxp SET xp = ${newxp}, level = ${level}, canget = '"n"' WHERE id = '${message.author.id}'`;
					con.query(sql);
				}
			}
		});


		setTimeout(function(){
			mainDatabaseConnectionPool.query(`UPDATE hammerxp SET canget = '"y"' WHERE id = '${message.author.id}'`);
		}, 180000);
	}

	if (!message.content.startsWith(config.prefix)) return;

	let messagearray = message.content.split(" ");
	let command = messagearray[0].substring(1);
	command = command.toLowerCase();
	let args = messagearray.slice(1);
	let serverid = message.channel.guild.id;

	//CORE
	if (command === "listcommands"){
		var Lembed = new Discord.RichEmbed()
			.setTitle("Hammer Bot Commands")
   			.setColor(0xffed00)
   			.addField(`Prefix:`,`;`)
   			.addField(`Basic`,` - Random Piratesong\n - yodish *text to convert to yodish*\n - RepairStory`)
   			.addField(`XP`,` - Rankcard`)
   			.addField(`Blazing Sails Specific`,` - bsinfo\n`)
   			.setTimestamp();
   		var Lembed2 = new Discord.RichEmbed()
			.setTitle("Music Bot Commands")
   			.setColor(0x00FFFF)
   			.addField(`Prefix:`,`&`)
   			.addField(`Basic Commands:`,` - Play (song URL / song name)\n - Skip\n - Stop\n - Queue\n - Current`)
   			.addField(`All commands:`,`[link](https://groovy.bot/commands)`)
   			.setTimestamp();
   		message.author.send(Lembed);
   		message.author.send(Lembed2);
		if (message.member.roles.has("626871464309817394") || message.member.roles.has("626871388799500288")){
			var Lembed3 = new Discord.RichEmbed()
			.setTitle("Mod Commands")
   			.setColor(0xFF0000)
   			.addField(`Prefix:`,`;`)
   			.addField(`Commands:`,` - mute @user\n - unmute @ user`);
   			if (message.member.roles.has("626871388799500288")){
   				Lembed3.addField(`Admin Commands:`,` - ServerInfo\n - ban @user\n - announce\n - clear *number of messages to clear*\n`);
   			}
   			Lembed3.setTimestamp();
			message.author.send(Lembed3);
		}
		message.reply("Check your DMs 😉");
	}

	//XP
	if (command === "rankcard"){
		mainDatabaseConnectionPool.query(`SELECT * FROM hammerxp WHERE id = '${message.author.id}'` , (err,rows) => {
			let xpneeded;
			let rnxp;
			if (parseInt(rows[0].level) === 0){
				xpneeded = 400;
			}else{
				xpneeded = parseInt(rows[0].level) * 800;
			}
			if (xpneeded > 1000){
				xpneeded = parseInt(xpneeded.toString().slice(0,-2))/10 + "k";
			}
			if (parseInt(rows[0].xp) > 1000){
				rnxp = parseInt((rows[0].xp).toString().slice(0,-2))/10 + "k";
			}else{
				rnxp = rows[0].xp;
			}
			let rankcard = new Discord.RichEmbed()
							.setColor('#0099ff')
							.setTitle(`${message.member.user.username}`)
							.setAuthor(`Rank card`)
							.setDescription(`xp ${rnxp} / ${xpneeded}. lvl ${rows[0].level}`)
							.setImage(`${message.author.displayAvatarUR}`)
							.setTimestamp();
			message.channel.send(rankcard);
		});
	}

	//AUDIO
	if (command === "random"){

		let voiceChannel = message.member.voiceChannel;

		if (!voiceChannel){
			message.channel.send("You must be in a Voice Channel to use this command!");
			message.react("❌");
		}else if (isPlaying){
			message.channel.send("I am currently busy!");
			message.react("🚫");
		}else if (args[0] === "piratesong"){

			let num = getRandomInt(datafile.RandomPirateSongs.length)+1;

			let songinfo = {
				"URL" : `${datafile.RandomPirateSongs[num].URL}`,
				"Name" : `${datafile.RandomPirateSongs[num].Name}`,
				"Author" : `${datafile.RandomPirateSongs[num].Author}`
			}

			isPlaying = true;

			voiceChannel.join().then(connection =>{
				currentDispatcher = connection
					.playStream(
        			  	ytdl(songinfo.URL,{filter:'audioonly',quality:'highestaudio',highWaterMark:1<<25}, {highWaterMark: 1})
      				)
      				.on("end",() =>{
      					voiceChannel.leave();
      					isPlaying = false;
      				})
      				.on("error",e=>{
      					console.error(e);
     				 	voiceChannel.leave();
     				 	isPlaying = false;
     				});
     			currentDispatcher.setVolumeLogarithmic(1);
    		});

    		message.react("▶️");

			var Sembed = new Discord.RichEmbed()
				.setTitle("Now Playing")
   				.setColor(0xadd8e6)
   				.addField(`URL:`,`[${songinfo.URL}](${songinfo.URL})`)
   				.addField(`Name:`,`${songinfo.Name}`)
   				.addField(`Author:`,`${songinfo.Author}`)
   				.setTimestamp();

   			message.channel.send(Sembed);
		}else{
			message.channel.send("The correct way to use this command is:\n ```;random piratesong```");
		}
	}
	if (command === "stop"){
		if (!isPlaying){
			message.channel.send("I am not currently in a voice channel!");
		}else if (!currentDispatcher){
			message.channel.send("I am not currently playing anything!");
		}else{
			currentDispatcher.end();
			message.react("🛑");
			message.channel.send("I have stopped");
		}
	}

	//BS COMMANDS
	if (command === "bsinfo"){
		if (!args || args.length < 2){
			message.channel.send("To use this command, specify which item you are looking for: `weapons`,`resources`,`shipupgrades`\nAn example: ;bsinfo `weapons` `bow`");
		}else{
			getWikiInfo(message,args);
		}
	}

	//MEME COMMANDS
	if (command === "yodish"){
		yodish(message,args);
	}
	if (command === "repairstory"){
		message.channel.send(`You start repairing your hull, look at the barrel and suddenly see the other crew-members took all the wood. "Ok, no problem" you think "I still have 100 wood left, this must work". All of a sudden you realize you waited way to long to repair because you rather shoot the cannons instead of repairing. Look where that got you... Now you're slowly sinking to the ocean floor! And your wood supplies are running dry! You see the last 30 minutes of the match flash before you. "How did I end up in this mess" you gently ask yourself. But you realize all too well what caused all this. The simple fact that you're more willing to "pew-pew" some ships now destroyed ANY chances of you winning the battle...you're doomed!! But wait... Suddenly, out of nowhere your wood stealing crew-mates appear in the hull and start repairing like hell! You realize he just corked the other team and they're sinking as well! In the meantime the three of you are repairing like madmen. If the water-level would rise even by one inch it's over... Before you know it the job is done... Victory! You shout! You start too cry and start jumping up and down with your crew-members. And then... A ship passes by, shoots 2 barrels and you sink. Boom! Reality. Start repairing sooner next time Bilge-rat!`);
	}

	if (command === "givefishrole"){
		if (message.member.roles.has("715339853121847357")){
			try{
				let role = bot.guilds.get("626871238752731146").roles.get("715349062693421137");
				let user = message.guild.members.find('id',message.mentions.users.first().id);
				if (user.roles.has("715349062693421137")){
					message.reply("This user already has this role!");
				}else{
					user.addRole(role);
					message.reply("Done!");
				}
			}catch(e){
				console.log(e);
				message.channel.send("Please make sure you entered it as: ;giveFishRole `@user`!");
			}
		}else{
			message.reply("You cannot use that command!");
		}
	}

	if (command === "removefishrole"){
		if (message.member.roles.has("715339853121847357")){
			try{
				let role = bot.guilds.get("626871238752731146").roles.get("715349062693421137");
				let user = message.guild.members.find('id',message.mentions.users.first().id);
				if (user.roles.has("715349062693421137")){
					user.removeRole(role);
					message.reply("Done!");
				}else{
					message.reply("This user does not have this role!");
				}
			}catch(e){
				console.log(e);
				message.channel.send("Please make sure you entered it as: ;removeFishRole `@user`!");
			}
		}else{
			message.reply("You cannot use that command!");
		}
	}

	//STAFF COMMANDS
	if (command === "mute"){
		if (!message.member.roles.has(serverRoles.moderator)) return message.reply("You cannot use this command!");
		let member = message.guild.members.find('id',message.mentions.users.first().id);
		try{
			member.addRole("626936865831780397");
			bot.channels.get("626938520090443776").send(`${member} has been muted by ${message.author}`);
		}catch(e){
			message.reply("Please check you have entered the details correctly / the user isn't already muted.");
		}
	}
	if (command === "unmute"){
		if (!message.member.roles.has(serverRoles.moderator)) return message.reply("You cannot use this command!");
		let member = message.guild.members.find('id',message.mentions.users.first().id);
		try{
			member.removeRole("626936865831780397");
			bot.channels.get("626938520090443776").send(`${member} has been unmuted by ${message.author}`);
		}catch(e){
			message.reply("Please check you have entered the details correctly / if the user is muted.");
		}
	}

	if (command === "mod"){
		if (message.member.roles.has(serverRoles.administrator)){
			if (args[0] === "add"){
				addMod(args[1]);
				message.reply("Done!");
			}else
			if (args[0] === "remove"){
				removeMod(args[1]);
				message.reply("Done!");
			}
		}else{
			message.reply("You do not have permissions to do this!");
		}
	}

	//ADMIN COMMANDS
	if (command === "serverinfo"){
		if (!message.member.roles.has(serverRoles.administrator)) return message.reply("You cannot use this command!");
		let features = "";
		if (!(message.guild.features.length > 0)){
			features = "-";
		}else{
			features = message.guild.features.join(",");
		}
		var booster_role = message.guild.members.filter(m => m.roles.has("585791793673535490"));
		var bans = null;
		var webhooks = null;
		message.guild.fetchWebhooks().then(result => {
			webhooks = result.size;
		});
		message.guild.fetchBans().then(result => {
			bans = result.size;
		});
		let serverinfo = new Discord.RichEmbed()
				.setColor('#00008b')
				.setTitle(`${message.guild.name}`)
				.setDescription(`Server Information`)
				.addField('Basic', `Owner: ${message.guild.owner}\nCreated on: ${message.guild.createdAt}\nAcronym: ${message.guild.nameAcronym}\nRegion: ${message.guild.region}`)
				.addField('Total Members', `Real People: ${message.guild.members.filter(member => !member.user.bot).size}\nBots: ${message.guild.members.filter(member => member.user.bot).size}`)
				.addField('Additional Info', `Number of Roles:\nNumber of Bans:\nMFA Level Required:\nNumber of Webhooks:\nDefault Message Notifications:`,true)
				.addField('-----', `${message.guild.roles.size}\n${bans}\n${message.guild.mfaLevel}\n${webhooks}\n${message.guild.defaultMessageNotifications}`,true)
				.addField('Nitro', `Boosters: ${booster_role.size}\nLevel: ${message.guild.premiumTier}\nVanity URL: ${message.guild.vanityURLCode}`,)
				.addField('Number of Channels', `Categories: ${message.guild.channels.filter(channel => channel.type === "category").size}\nText: ${message.guild.channels.filter(channel => channel.type === "text").size}\nVoice: ${message.guild.channels.filter(channel => channel.type === "voice").size}`,true)
				.addField('Verification', `Level: ${message.guild.verificationLevel}\nStatus: ${message.guild.verified}`,true)
				.addField('Emoji Count', `${message.guild.emojis.size}`,true)
				.addField('Explicit content filter level', `${message.guild.explicitContentFilter}`,true)
				.addField('Features', `${features}`)
				.addField('AFK', `Channel: ${message.guild.afkChannel}\nTimeout: ${message.guild.afkTimeout}sec`,true)
				.setImage(`${message.guild.iconURL}`)
				.setTimestamp();
		message.channel.send(serverinfo);
	}
	if (command === "ban"){
		if (!message.member.roles.has(serverRoles.administrator)) return message.reply("You cannot use this command!");
		if (args[0] === "discord"){
			let member = message.guild.members.cache.find('id',message.mentions.users.first().id);
			try{
				message.guild.ban(member);
				bot.channels.get("626938520090443776").send(`${member} has been banned by ${message.author}`);
			}catch(e){
				message.reply("Please check you have entered the details correctly.");
			}
		}else
		if (args[0] === "bwserver"){
			if (args[1] === "add"){
				addBan(args[2]);
			}else
			if (args[1] === "remove"){
				removeBan(args[2]);
			}else{
				message.reply("That is not a valid option!");
			}
		}
	}
	if (command === "announce"){
		if (!message.member.roles.has(serverRoles.administrator)) return message.reply("You cannot use this command!");
		bot.channels.get("627112517944082442").send(args.join);
	}
	if (command === 'clear'){
		if (!message.member.roles.has(serverRoles.administrator)) return message.reply("You cannot use this command!");
		var deleteCount = parseInt(args[0]);
		if (deleteCount === 0 || isNaN(deleteCount) || deleteCount < 0) {
			message.channel.send("Please enter a valid number.");
			return;
		}
		if (deleteCount > 100){
			let noruns = parseInt(deleteCount/100);
			let onesleft = deleteCount % 100;
			let runno = 0;
			while (noruns != runno){
				message.channel.bulkDelete(100).catch(error => message.reply("Couldn't delete messages because of:"+error+"."));
				runno++;
			}
			message.channel.bulkDelete(onesleft).catch(error => message.reply("Couldn't delete messages because of:"+error+"."));
			message.channel.send("deleted "+deleteCount+" messages.").then(message => {message.delete(3000)});
		}else{
			if (deleteCount <= 2){
				message.channel.send("Do it yourself you lazy bugger.");
				return;
			}else{
				message.channel.bulkDelete(deleteCount).catch(error => message.channel.send(`Counldn't delete messages because of: ${error}.`));
				message.delete();
				message.channel.send("Deleted "+deleteCount+" messages.").then(message => {message.delete(3000)});
			}
		}
	}

	//OWNER ONLY COMMANDS
	if (command === "restart"){
		if (message.author.id === "337541914687569920"){
			await message.channel.send("Restarting....");
			process.exit();
		}
	}
	if (command === "do"){
		if (message.author.id === "337541914687569920"){
			try{
				let code = args.join(" ");
				let evaled = eval(code);
				if (typeof evaled !== "string"){
       				evaled = require("util").inspect(evaled);
				}
				message.channel.send(clean(evaled), {code:"xl"});
    		} catch (err) {
      		message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
    		}
		}
	}

	return;
});

bot.on("roleCreate", function(role){
    bot.channels.get("641408290357641217").send(`A role was created: **${role.name}**`);
});

bot.on("roleDelete", function(role){
    bot.channels.get("641408290357641217").send(`A role was deleted: **${role.name}**`);
});

bot.on("channelPinsUpdate", function(channel,time){
    bot.channels.get("626938520090443776").send(`A message was pinned in: ${channel}`);
});

bot.on("voiceStateUpdate", (oldMember,newMember) => {
	let newUserChannel = newMember.voiceChannel;
	let oldUserChannel = oldMember.voicechannel;
	if(oldUserChannel === undefined & newUserChannel !== undefined){
		if(newMember.user.id === "234395307759108106" & newMember.voiceChannelID !== "627120498110889986"){
			bot.channels.get(newMember.voiceChannelID).setName("Music");
		}
	}else
	if(newUserChannel === undefined){
		if(newMember.user.id === "234395307759108106"){
			bot.channels.get(oldMember.voiceChannelID).setName("Voice Room");
		}
	}else{
		return;
	}
});

bot.on("guildMemberRemove", async function(member){
	var entry = await bot.guilds.get("626871238752731146").fetchAuditLogs({type: 'MEMBER_KICK'}).then(audit => audit.entries.first());
	if(typeof entry === undefined || entry === null){
	}else{
		if (entry.createdTimestamp > (Date.now() - 5000)){
			let embed = new Discord.RichEmbed()
						.setColor('#0099ff')
						.setTitle("User Kicked")
						.addField("User",`${entry.target}`)
						.addField("Executor",`${entry.executor}`)
						.addField("Reason",`${entry.reason}`)
						.setThumbnail(`${entry.target.displayAvatarURL}`)
						.setTimestamp();
			bot.channels.get("626938520090443776").send(embed);
		}
	}
});

bot.on('guildBanAdd', async (guild,user) => {
  	var entry = await guild.fetchAuditLogs({type: 'MEMBER_BAN_ADD'}).then(audit => audit.entries.first());
  	if (entry.createdTimestamp > (Date.now() - 5000)){
  		let embed = new Discord.RichEmbed()
					.setColor('#0099ff')
					.setTitle("User Banned")
					.addField("User",`${entry.target}`)
					.addField("Executor",`${entry.executor}`)
					.addField("Reason",`${entry.reason}`)
					.setThumbnail(`${entry.target.displayAvatarURL}`)
					.setTimestamp();
		bot.channels.get("626938520090443776").send(embed);
	}
});

bot.on('guildBanRemove', async (guild,user) => {
  	var entry = await guild.fetchAuditLogs({type: 'MEMBER_BAN_REMOVE'}).then(audit => audit.entries.first());
  	let embed = new Discord.RichEmbed()
						.setColor('#0099ff')
						.setTitle("User UnBanned")
						.addField("User",`${entry.target}`)
						.addField("Executor",`${entry.executor}`)
						.setThumbnail(`${entry.target.displayAvatarURL}`)
						.setTimestamp();
	bot.channels.get("626938520090443776").send(embed);
});

bot.on('raw', async event => {
	if (logEverySingleEvent){
		console.log(event);
	}
    if (!(event.t === 'MESSAGE_REACTION_ADD' || event.t === 'MESSAGE_REACTION_REMOVE')){
		return;
	}
    if (!(parseInt(event.d.channel_id) === 640195863255449610)){
        return;
    }	
    let member = bot.guilds.get("626871238752731146").members.get(event.d.user_id);
	if (event.t === "MESSAGE_REACTION_ADD"){
		if (event.d.emoji.name === "📣"){
			let role = bot.guilds.get("626871238752731146").roles.get("640185758963204097");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🇿🇦"){
			let role = bot.guilds.get("626871238752731146").roles.get("649321132620644403");
			member.addRole(role);
		}
		
		if (event.d.emoji.name === "🇷🇺"){
			let role = bot.guilds.get("626871238752731146").roles.get("649321961670836225");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🇬🇧"){
			let role = bot.guilds.get("626871238752731146").roles.get("649321980587409424");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🇳🇱"){
			let role = bot.guilds.get("626871238752731146").roles.get("649322781082779682");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🇩🇪"){
			let role = bot.guilds.get("626871238752731146").roles.get("649322948615995406");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🇫🇷"){
			let role = bot.guilds.get("626871238752731146").roles.get("649329375262670858");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🇳🇴"){
			let role = bot.guilds.get("626871238752731146").roles.get("651816578241003530");
			member.addRole(role);
		}
		if (event.d.emoji.name === "⛵"){
			let role = bot.guilds.get("626871238752731146").roles.get("660572751806988327");
			member.addRole(role);
		}
		if (event.d.emoji.id === "626899921827528732"){
			let role = bot.guilds.get("626871238752731146").roles.get("640198086412599364");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🧊"){
			let role = bot.guilds.get("626871238752731146").roles.get("660580368016998436");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🌍"){
			let role = bot.guilds.get("626871238752731146").roles.get("701206938490241046");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🌎"){
			let role = bot.guilds.get("626871238752731146").roles.get("701207044472045669");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🌏"){
			let role = bot.guilds.get("626871238752731146").roles.get("701207108246569070");
			member.addRole(role);
		}
		if (event.d.emoji.name === "🗺️"){
			let role = bot.guilds.get("626871238752731146").roles.get("701209745477992559");
			member.addRole(role);
		}
	}
	if (event.t === "MESSAGE_REACTION_REMOVE"){
		if (event.d.emoji.name === "📣"){
			let role = bot.guilds.get("626871238752731146").roles.get("640185758963204097");
			member.removeRole(role);
		}
		if (event.d.emoji.id === "🇿🇦"){
			let role = bot.guilds.get("626871238752731146").roles.get("649321132620644403");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🇬🇧"){
			let role = bot.guilds.get("626871238752731146").roles.get("649321980587409424");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🇷🇺"){
			let role = bot.guilds.get("626871238752731146").roles.get("649321961670836225");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🇳🇱"){
			let role = bot.guilds.get("626871238752731146").roles.get("649322781082779682");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🇩🇪"){
			let role = bot.guilds.get("626871238752731146").roles.get("649322948615995406");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🇫🇷"){
			let role = bot.guilds.get("626871238752731146").roles.get("649329375262670858");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🇳🇴"){
			let role = bot.guilds.get("626871238752731146").roles.get("651816578241003530");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "⛵"){
			let role = bot.guilds.get("626871238752731146").roles.get("660572751806988327");
			member.removeRole(role);
		}
		if (event.d.emoji.id === "626899921827528732"){
			let role = bot.guilds.get("626871238752731146").roles.get("640198086412599364");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🧊"){
			let role = bot.guilds.get("626871238752731146").roles.get("660580368016998436");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🌍"){
			let role = bot.guilds.get("626871238752731146").roles.get("701206938490241046");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🌎"){
			let role = bot.guilds.get("626871238752731146").roles.get("701207044472045669");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🌏"){
			let role = bot.guilds.get("626871238752731146").roles.get("701207108246569070");
			member.removeRole(role);
		}
		if (event.d.emoji.name === "🗺️"){
			let role = bot.guilds.get("626871238752731146").roles.get("701209745477992559");
			member.removeRole(role);
		}
	}
});

bot.on("error" , console.error);
bot.login(config.token);