exports = function(changeEvent) {
  const SLACK_EMOTRADE_CHANNEL_URL = context.values.get('slack').emotrade_channel_url;

  const trade = changeEvent.fullDocument;
  const slack = context.services.get('Slack');

  return slack.post({
    url: SLACK_EMOTRADE_CHANNEL_URL,
    body: {
      text: context.functions.execute('slackRender', 'trade', trade),
    },
    encodeBodyAsJSON: true,
  });
};
