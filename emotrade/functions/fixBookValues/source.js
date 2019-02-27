exports = function() {
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('trades');
  return collection.find({}, {
    _id: 1,
    user_id: 1,
    cash_delta: 1,
    count: 1,
    emoji: 1,
  })
    .sort({user_id: 1, emoji: 1, timestamp: 1})
    .toArray()
    .then((trades) => {
      let user;
      let emoji;
      let purchase_price;
      trades.map((trade) => {
        if (user !== trade.user_id) {
          user = trade.user_id;
          emoji = undefined;
          purchase_price = undefined;
        }
        if (emoji !== trade.emoji) {
          emoji = trade.emoji;
          purchase_price = undefined;
        }
        const cash_delta = Math.round(trade.cash_delta * 100) / 100;
        if (cash_delta > 0) {
          console.log(`sold ${trade.count} ${emoji} at ${Math.round(trade.cash_delta / trade.count * 100) / 100} / ${-purchase_price}`);
        } else {
          purchase_price = Math.round(cash_delta / trade.count * 100) / 100;
        }
        const buy_price = -purchase_price;
        const book_value_delta = Math.round(buy_price * trade.count * 100) / 100;
        return collection.updateOne({
          _id: trade._id,
        }, {
          $set: {
            buy_price,
            book_value_delta,
          },
        }).then((result) => {
          console.log(JSON.stringify(result));
        });
      });
    });
};
