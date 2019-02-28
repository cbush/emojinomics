exports = function() {
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('reactions');
  return collection.find({ts: {$exists: false}}, {
    _id: 1,
    ts: 1,
    user: 1,
    item_user: 1,
    reaction: 1,
    value: 1,
  })
    .toArray()
    .then((entries) => {
      entries.forEach((e) => {
        const d = {
          _id: e._id,
          ts: e.ts,
          user: e.user,
          item_user: e.item_user,
          emoji: e.reaction,
          value: e.value,
          type: e.value > 0 ? 1 : -1,
          team_id: 'T85HG4GGZ',
          api_app_id: 'AGF9998H4',
        };
        return collection.updateOne({
          _id: e._id,
        }, d).then((result) => {
          console.log(JSON.stringify(result));
        });
      });
    });
};
