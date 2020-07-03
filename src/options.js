//document.querySelector('#test').innerHTML = typeof chrome.storage.local;

let bttvUsers = {};
let bttvEmotes = {};
let messageTimeout;

const Settings = {
	// debug method
	reset() {
		chrome.storage.local.set({ bttvUsers: {}, bttvEmotes: {} }, () => {
			bttvUsers = {};
			bttvEmotes = {};
		});
	},
	addUser(userID, username) {
		if (typeof userID === 'string') {
			userID = parseInt(userID);
		}

		return new Promise((resolve) => {
			let addUser = typeof bttvUsers[userID] === 'undefined';

			bttvUsers[userID] = { username, lastUpdate: Date.now() }; // update
			chrome.storage.local.set({ bttvUsers, bttvEmotes }, () => {
				if (addUser) {
					this.BTTV.addUserToList(userID);
				}
				resolve();
			});
		});
	},
	fetch(...args) {
		return new Promise((resolve, reject) => {
			fetch(...args).then((response) => {
				response.json().then((json) => {
					if (response.status === 200) {
						resolve(json);
					}
					else {
						reject(json);
					}
				});
			});
		});
	},
	showMessage(message, type = 'success') {
		if (messageTimeout) {
			clearTimeout(messageTimeout);
		}

		let statusElement = document.querySelector('#status');
		let textElement = statusElement.querySelector('p');
		textElement.innerHTML = message;
		textElement.classList.remove(...statusElement.classList);
		textElement.classList.add(type);
		statusElement.classList.add('active');
		let hide = () => {
			console.log('hide lol');
			statusElement.removeEventListener('click', hide);
			statusElement.classList.remove('active');
			messageTimeout = null;
		};
		statusElement.addEventListener('click', hide);
		messageTimeout = setTimeout(hide, 5000);
	},
	Twitch: {
		getUserID(username) {
			return Settings.fetch('https://api.twitch.tv/kraken/users?login=' + username, {
				headers: {
					'Client-ID': 'd25rzn77s7qfk0b16un4su9mxjv0ge1',
					Accept: 'application/vnd.twitchtv.v5+json'
				}
			}).then((data) => {
				return data.users;
			});
		}
	},
	BTTV: {
		getUserEmotes(userID) {
			return Settings.fetch('https://api.betterttv.net/3/cached/users/twitch/' + userID);
		},
		updateUserChannelEmotes(userID, username) {
			return this.getUserEmotes(userID).then((bttvData) => {
				return this.updateEmotes(userID, bttvData);
			}).then(() => {
				return Settings.addUser(userID, username);
			}).catch(e => {
				console.debug(e);
				return Promise.reject('User has no BetterTTV.');
			});
		},
		updateEmotes(userID, bttvData) {
			bttvEmotes[userID] = {};

			let emoteList = [];
			if (Array.isArray(bttvData.channelEmotes)) {
				emoteList = emoteList.concat(bttvData.channelEmotes);
			}
			if (Array.isArray(bttvData.sharedEmotes)) {
				emoteList = emoteList.concat(bttvData.sharedEmotes);
			}

			for (let emote of emoteList) {
				bttvEmotes[userID][emote.code] = emote.id;
			}
		},
		addUser() {
			let userElement = document.querySelector('#bttvAddUser');
			let username = userElement.value.trim();
			if (!username.length) {
				return;
			}

			if (isBusy) {
				return;
			}

			userElement.setAttribute('disabled', true);
			isBusy = true;
			let beforeEmotes = Object.keys(Helper.BTTV.emotes).length;
			let userID;
			Settings.Twitch.getUserID(username).then((data) => {
				if (data.length) {
					userID = data[0]._id;
					if (typeof bttvUsers[userID] !== 'undefined') {
						return Promise.reject('User already in list');
					}

					return this.updateUserChannelEmotes(userID, data[0].display_name);
				}
				else {
					return Promise.reject('Twitch user not found');
				}
			}).then(() => {
				return Helper.BTTV.update().then(() => Helper.BTTV.loaded());
			}).then(() => {
				let newEmotes = Object.keys(Helper.BTTV.emotes).length - beforeEmotes;
				Settings.showMessage('User added and ' + newEmotes + ' new emotes.');
			}).then(() => {}).catch((err) => {
				console.debug('fehler....', err);
				Settings.showMessage(err, 'error');
			}).finally(() => {
				userElement.value = '';
				userElement.removeAttribute('disabled');
				isBusy = false;
			});
		},
		addUserToList(userID, list = document.querySelector('#bttvUserList')) {
			let user = bttvUsers[userID];
			let li = document.createElement('li');
			li.id = 'bttvUser' + userID;
			li.innerText = user.username + ' (last update: ' + (new Date(user.lastUpdate)).toLocaleString() + ')';
			list.append(li);
		}
	}
};

// debug reset
// chrome.storage.local.set({ bttvUsers: {} });
chrome.storage.local.get((items) => {
	bttvUsers = items.bttvUsers || {};
	bttvEmotes = items.bttvEmotes || {};
	let list = document.querySelector('#bttvUserList');
	for (let userID in bttvUsers) {
		if (bttvUsers.hasOwnProperty(userID)) {
			Settings.BTTV.addUserToList(userID, list);
		}
	}
});

Helper.BTTV.loaded = function () {
	let bttvEmoteList = document.querySelector('#bttvEmoteList');
	bttvEmoteList.innerText = '';
	for (let emote in this.emotes) {
		if (this.emotes.hasOwnProperty(emote)) {
			let li = document.createElement('li');
			let img = document.createElement('img');
			let span = document.createElement('span');
			span.innerText = emote;
			img.src = 'https://cdn.betterttv.net/emote/' + this.emotes[emote] + '/3x';
			li.classList.add('emoteCard');
			li.append(img);
			li.append(span);
			bttvEmoteList.append(li);
		}
	}
};

let isBusy = false;

document.querySelector('#bttvAddUserBtn').addEventListener('click', () => {
	Settings.BTTV.addUser();
});
document.querySelector('#bttvAddUser').addEventListener('keyup', (event) => {
	if (event.key !== 'Enter') {
		return;
	}

	Settings.BTTV.addUser();
});