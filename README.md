# Matrix <--> Ryver Bridge

This is a [Ryver](https://ryver.com/) bridge for Matrix using the Application Services (AS) API via the [matrix-appservice-bridge](https://github.com/matrix-org/matrix-appservice-bridge) library.
This bridge will pass all Ryver messages for pre-configured Matrix users to corresponding Matrix rooms, and vice-versa. This is a double-puppeting bridge, meaning users see all messages as sent by the correct native user rather than a bot. The Matrix users to be bridged must have pre-existing accounts in the Ryver org.

## Setup
There are 3 steps to setting up the Ryver bridge. You will need to be an organization admin on the Ryver organization you want to bridge with.

### 1. Installation
Run `git clone` this repository's `master` branch, and run `npm install`. The bridge runs from `node index.js`.
#### Requirements
* Node.js v10.16.0 or above
* A Matrix homeserver you control -- v1.12.3 or above recommended, but may work on earlier versions.

### 2. Configuration
The bridge needs to be configured to run correctly. 
* Copy `config.example.js` to `config.js` and modify to point to your homeserver and Ryver organization.
* Copy `usermap.example.js` to `usermap.js` and populate it with the Matrix users you want to bridge to Ryver and their Ryver user IDs. Note these IDs need to be the numberical IDs found in their user URL, and not their `@` name.
* Create an outbound and inbound webhook in your Ryver org to/from your homeserver on the port you specified for the bridge.
* Ensure your homeserver's firewall/network is configured to accept traffic on the port you specified.

### 3. Running
The bridge will be registered automatically when run. Execute the following command to start the bridge:
```
node index.js -p 9000
```

## What does it do?
On startup, the bridge will use the mapping file you create to poll Ryver and determine which Ryver teams those users are members of, and create (if they don't exist) rooms for those teams and invite the Matrix users to those rooms (if they aren't already there). It will also create Matrix users for each Ryver user in a bridged room, but those users will not be able to log in.
Any time a message is sent in a bridged Ryver team, the message will automatically appear in the corresponding Matrix room and look like it was sent by the Matrix user that maps to the Ryver user that actually sent the message. When a Matrix user sends a message in a bridged room, the message automatically appears in the corresponding Ryver team showing as from the Matrix user's bona-fide Ryver account.

## Usage
Just accept the invite from the bot to a Ryver room, and start chatting! Note that messages sent before the room was bridged the first time won't appear in the room, and enabling E2E encryption may break everything.
