exports = function(payload) {
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

  // Nerf the value if the user has recently traded any of the emoji stock.
  return context.functions.execute('getPortfolio', event.user)
    .then((portfolio) => {
      const now = (event.event_ts && parseInt(event.event_ts * 1000)) || new Date().getTime();
      const nerfCooldownStart = now - 7 * 24 * 60 * 60 * 1000;
      const emoji = event.reaction.replace(/::.*$/, ''); // ignore skin tones
      let value = event.type === 'reaction_removed' ? -1 : 1;

      value *= 0.1;

      const {holdings} = portfolio;
      for (let i in holdings) {
        const holding = holdings[i];
        if (holding.emoji !== emoji) {
          continue;
        }

        const {last_transaction} = holding;
        /*
        if (last_transaction < nerfCooldownStart) {
          // Transaction is old enough: no nerf applied
          break;
        }

        // More recent transactions are nerfed harder than older transactions up to the cooldown window.
        const nerf = Math.min(
          Math.max(
            0.1 - (holding.last_transaction - nerfCooldownStart) / (now - nerfCooldownStart),
            0
          ),
          0.1 // holders are always nerfed
        );
        */
        const nerf = 0.1;

        if (nerf < 0.0001) {
          return;
        }
        value *= nerf;
        break;
      }

      value = Math.round(value * 1000) / 1000;

      // Ignore events from the same user for the same reaction within the last 5 minutes.
      const ignoreDuration = 5 * 60 * 1000;
      return collection.updateOne({
        user: event.user,
        reaction: emoji,
        value,
        timestamp: {$gt: now - ignoreDuration},
      }, {
        user: event.user,
        item_user: event.item_user,
        reaction: emoji,
        timestamp: now,
        value,
      }, {
        upsert: true,
      });
    });
};
