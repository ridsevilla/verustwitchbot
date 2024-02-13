# verustwitchbot

## Requirements
-Fully synced Verus wallet with RPC enabled: [https://github.com/VerusCoin/VerusCoin/releases](https://github.com/VerusCoin/VerusCoin/releases)

## Installation

First, setup [Node.js](https://nodejs.org/en/).

Install the following:

```
npm install bignumber.js sqlite3 tmi.js
```

Edit `config-default.json` with the appropriate values and save as `config.json`.

Please use appropriate measures to secure your credentials before using in production.

You may generate your bot's Twitch OAuth Token with [https://twitchapps.com/tmi/](https://twitchapps.com/tmi/) (a Twitch community-driven wrapper around the Twitch API), while logged in to your bot's Twitch account. The token will be an alphanumeric string. To use in a production setting, it is recommended that you register your bot with Twitch and use a more secure OAuth Authorization code flow.

To run `verustwitchbot`:

```
node index.js
```

## Usage

```
streamer commands:
-send vrsc: !v <amount> <twitch-viewer-tag>
-rain vrsc: !vrain <amount>

viewer commands:
-set vrsc wallet: !vrsc <address>
-view vrsc wallet: !vrsc

notes:
-shortform for !vrsc: !va
-can interchange ! with $
```

## Thanks

Thanks to animokaiman, cautionfun, and rckmtl!

---

VRSC: [rid.PBaaSLaunch@](https://insight.verus.io/address/rid.PBaaSLaunch@)
