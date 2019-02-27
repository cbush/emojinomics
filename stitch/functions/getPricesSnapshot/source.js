exports = function({emojis}) {
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('prices');

  const now = parseInt(new Date().getTime() / 100000) * 100000;

  return collection.find({}, {ts: 1, byEmoji: 1})
    .sort({ts: -1})
    .limit(1)
    .toArray()
    .then((results) => {
      const result = results[0];
      const prices = [];
      for (let emoji in result.byEmoji) {
        if (emojis !== undefined && emojis.indexOf(emoji) === -1) {
          continue;
        }
        const price = result.byEmoji[emoji];
        const previous = price.history.day;
        price.emoji = emoji;
        price.previous_count = previous.count;
        price.previous_price = previous.price;
        price.change = previous.change;
        price.change_abs = previous.change_abs;
        price.change_percent_abs = previous.change_percent_abs;
        price.change_percent = previous.change_percent_abs;
        price.change_sign = previous.change_sign;
        prices.push({
          emoji,
          price: price.price,
          count: price.count,
          previous_count: previous.count,
          previous_price: previous.price,
          change: previous.change,
          change_abs: previous.change_abs,
          change_percent_abs: previous.change_percent_abs,
          change_percent: previous.change_percent_abs,
          change_sign: previous.change_sign,
        });
      }
      return prices;
    });
};