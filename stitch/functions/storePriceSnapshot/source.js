const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function calculatePrices(args) {
  return context.functions.execute('calculatePrices', args);
}

function coarsifyMs(ms) {
  return parseInt(ms / 100000) * 100000;
}

exports = function() {
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('prices');
  
  const when_ms = coarsifyMs(new Date().getTime());

  const one_hour_ago = coarsifyMs(when_ms - HOUR_MS);
  const three_hours_ago = coarsifyMs(when_ms - 3 * HOUR_MS);
  const twelve_hours_ago = coarsifyMs(when_ms - 12 * HOUR_MS);
  const yesterday = coarsifyMs(when_ms - DAY_MS);
  const three_days_ago = coarsifyMs(when_ms - 3 * DAY_MS);
  const one_week_ago = coarsifyMs(when_ms - 7 * DAY_MS);
  const two_weeks_ago = coarsifyMs(when_ms - 2 * 7 * DAY_MS);
  const four_weeks_ago = coarsifyMs(when_ms - 4 * 7 * DAY_MS);
  const changeSinceMsArray = [
    one_hour_ago,
    three_hours_ago,
    twelve_hours_ago,
    yesterday,
    three_days_ago,
    one_week_ago,
    two_weeks_ago,
    four_weeks_ago,
  ];

  return calculatePrices({
    whenMs: when_ms,
    changeSinceMsArray,
  }).then((prices) => {
    const document = {};
    document.ts = when_ms;
    const byEmoji = {};
    prices.map((price) => {
      byEmoji[price.emoji] = {
        emoji: price.emoji,
        count: price.count,
        price: price.price,
        ts: when_ms,
        history: {
          hour: price.history[one_hour_ago],
          hour3: price.history[three_hours_ago],
          hour12: price.history[twelve_hours_ago],
          day: price.history[yesterday],
          day3: price.history[three_days_ago],
          week: price.history[one_week_ago],
          week2: price.history[two_weeks_ago],
          month: price.history[four_weeks_ago],
        },
      };
    });
    document.byEmoji = byEmoji;
    return collection.insertOne(document);
  });
};