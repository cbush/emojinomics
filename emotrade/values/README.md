For development purposes, I'm not generating tokens yet via the OAuth install process.
Sensitive information is in the slack.json values file, which is why it has been placed
under gitignore. To recreate for your app, create slack.json in this directory with
the following json with appropriate values filled out for your slack app:

    {
        "id": "5c75f3765ca157fc4985d5d9",
        "name": "slack",
        "value": {
            "token": "<App token>",
            "dev_channel_url": "<Webhook for dev channel>",
            "emotrade_channel_url": "<Webhook for trading channel>",
            "main_channel_url": "<Webhook for main chat (use sparingly)>"
        },
        "from_secret": false
    }
