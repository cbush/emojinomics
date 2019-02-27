The stitch.json file that would be in this directory if not for gitignore
contains my stitch app-id. Not sure if this is actually sensitive, but
you should replace it with your own stitch app id anyway.

The stitch.json file looks like this:

    {
        "app_id": "<your-stitch-app-id>",
        "config_version": 20180301,
        "name": "emojinomics",
        "location": "US-VA",
        "deployment_model": "GLOBAL",
        "security": {},
        "hosting": {
            "enabled": false
        }
    }
