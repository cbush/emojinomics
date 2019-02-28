exports = async function(payload) {
  const body = EJSON.parse(payload.body.text());
  if (body.type === 'url_verification') {
    return body.challenge;
  }

  const {event} = body;

  if ((event.type !== 'reaction_added') && (event.type !== 'reaction_removed')) {
    return {};
  }

  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('reactions');

  const now = (event.event_ts && parseInt(event.event_ts * 1000, 10)) || new Date().getTime();
  const emoji = event.reaction.replace(/::.*$/, ''); // ignore skin tone variants

  const type = event.type === 'reaction_removed' ? -1 : 1;

  const powersByEmoji = await context.functions.execute('getReactPowersByEmoji', {emojis: [emoji]});
  const power = powersByEmoji[emoji];

  if (power === undefined) {
    throw new Error(`Power for emoji ${emoji} undefined!`);
  }

  let value = Math.round(type * power * 1000) / 1000;

  // Ignore events from the same user for the same reaction within the last 5 minutes.
  const ignoreDuration = 5 * 60 * 1000;

  const {user, item_user} = event;

  const lastReact = await collection.findOne({ // not update, as we still want to record who got the reaction
    ts: {$gt: now - ignoreDuration},
    user,
    emoji,
    type,
  });
  if (lastReact !== undefined) {
    value = 0;
  }
  return collection.insertOne({
    ts: now,
    user,
    item_user,
    emoji,
    value,
    type,
    team_id: body.team_id,
    api_app_id: body.api_app_id,
  });
};
