function renderPrice(p) {
  return context.functions.execute('slackRender', 'price', p);
}

function getList(name) {
  return context.functions.execute('getList', {name});
}

exports = function(arg) {
  const slackConfig = context.values.get('slack');
  const TOKEN = slackConfig.token;
  const DEV_CHANNEL = slackConfig.dev_channel_url;
  const MAIN_CHANNEL = slackConfig.main_channel_url;

  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('reactions');

  const now = new Date().getTime();
  const yesterday = now - 60 * 60 * 24 * 1000;

  return getList('top')
    .then((topList) => {
      return getList('hot')
        .then((hotList) => {
          let text = 
`*Emoji price report:*
>:bulb: Use _/emotrade help_ or join #emotrade

*Top emoji* :moneybag:
${topList.prices.map(renderPrice).join('\n')}

*Hot emoji* :hot_pepper:
${hotList.prices.map(renderPrice).join('\n')}`;

          const slack = context.services.get('Slack');
          return slack.post({
            url: DEV_CHANNEL,
            //url: MAIN_CHANNEL,
            body: {
              text
            },
            encodeBodyAsJSON: true,
          });

        });
    });
};