const MINIMUM_STOCK_PRICE = 1;
const WEEK = 7 * 24 * 60 * 60 * 1000;
const WINDOW_DURATION_MS = 4 * WEEK;

function minPriceAgg(price) {
  return {$max: [{$add: [1, price]}, MINIMUM_STOCK_PRICE]};
}

function timestampWithinRangeAgg(startMs, endMs) {
  return {
    $and: [
      {$gte: ['$ts', startMs]},
      {$gt: [endMs, '$ts']},
    ],
  };
}

function sumInWindowAgg(whenMs, agg) {
  const windowStartMs = whenMs - WINDOW_DURATION_MS;
  return {
    $sum: {
      $cond: {
        if: timestampWithinRangeAgg(windowStartMs, whenMs),
        then: agg(whenMs),
        else: 0,
      },
    },
  };
}

function decayForWeek(weekStart, decay) {
  const weekEnd = weekStart + WEEK;
  return {
    $cond: {
      if: timestampWithinRangeAgg(weekStart, weekEnd),
      then: decay,
      else: 1,
    },
  };
}

function priceAgg(whenMs) {
  const weeks = [
    1 * WEEK,
    2 * WEEK,
    3 * WEEK,
    4 * WEEK,
  ];
  return sumInWindowAgg(whenMs, () => ({
    $multiply: [
      '$value',
      decayForWeek(weeks[1], 0.75),
      decayForWeek(weeks[2], 0.5),
      decayForWeek(weeks[3], 0.25),
    ],
  }));
}

function countAgg(whenMs) {
  return sumInWindowAgg(whenMs, () => '$price');
}

exports = function({
  emojis, whenMs, changeSinceMs, changeSinceMsArray, $sort, $limit,
}) {
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('reactions');

  const pipeline = [];

  if (emojis !== undefined) {
    const $match = emojis.length === 1 ? {emoji: emojis[0]} : {$expr: {$in: ['$emoji', emojis]}};
    pipeline.push({$match});
  }

  if (whenMs === undefined) {
    whenMs = new Date().getTime();
  }

  const windowStartMs = Math.min(whenMs, changeSinceMs || whenMs) - WINDOW_DURATION_MS;
  const windowEndMs = Math.max(whenMs, changeSinceMs || whenMs);
  const $match = {$expr: timestampWithinRangeAgg(windowStartMs, windowEndMs)};
  pipeline.push({$match});

  const $group = {
    _id: '$emoji',
    price: priceAgg(whenMs),
    count: countAgg(whenMs),
  };

  const $project = {
    _id: 0,
    emoji: '$_id',
    price: minPriceAgg('$price'),
    count: 1,
  };

  if (changeSinceMs !== undefined) {
    $group.previous_price = priceAgg(changeSinceMs);
    $group.previous_count = countAgg(changeSinceMs);
    $project.previous_price = minPriceAgg('$previous_price');
    $project.previous_count = 1;
  }

  if (changeSinceMsArray !== undefined) {
    changeSinceMsArray.forEach((sinceMs, i) => {
      $group[`price_${i}`] = priceAgg(sinceMs);
      $group[`count_${i}`] = countAgg(sinceMs);
      $project[`price_${i}`] = minPriceAgg(`$price_${i}`);
      $project[`count_${i}`] = 1;
    });
  }

  pipeline.push({$group});
  pipeline.push({$project});

  if (changeSinceMs !== undefined) {
    const $project2 = {
      emoji: 1,
      price: 1,
      previous_price: 1,
      count: 1,
      previous_count: 1,
      change: {$subtract: ['$price', '$previous_price']},
      change_abs: {$abs: {$subtract: ['$price', '$previous_price']}},
      change_percent_abs: {$abs: {$subtract: [{$divide: ['$price', '$previous_price']}, 1]}},
    };
    pipeline.push({$project: $project2});
  }

  if (changeSinceMsArray !== undefined) {
    const $project2 = {
      emoji: 1,
      price: 1,
      count: 1,
    };
    changeSinceMsArray.forEach((sinceMs, i) => {
      $project2[`price_${i}`] = 1;
      $project2[`count_${i}`] = 1;
      $project2[`change_${i}`] = {$subtract: ['$price', `$price_${i}`]};
      $project2[`change_abs_${i}`] = {$abs: {$subtract: ['$price', `$price_${i}`]}};
      $project2[`change_percent_abs_${i}`] = {$abs: {$subtract: [{$divide: ['$price', `$price_${i}`]}, 1]}};
    });
    pipeline.push({$project: $project2});
  }

  if ($sort !== undefined) {
    pipeline.push({$sort});
  }

  if ($limit !== undefined) {
    pipeline.push({$limit});
  }

  return collection
    .aggregate(pipeline)
    .toArray()
    .then(results => new Promise((resolve) => {
      results.forEach((result) => {
        result.price = Math.round(result.price * 100) / 100;
        if (changeSinceMs !== undefined) {
          result.previous_price = Math.round(result.previous_price * 100) / 100;
          result.change_period_ms = whenMs - changeSinceMs;
          result.change = Math.round(result.change * 100) / 100;
          const {change} = result;
          result.change_sign = change >= 0 ? '+' : '-';
          const change_percent = Math.round(result.change_percent_abs * 100) / 100;
          result.change_percent = change_percent;
        }

        if (changeSinceMsArray !== undefined) {
          result.history = {};
          changeSinceMsArray.forEach((sinceMs, i) => {
            result.history[sinceMs] = {
              price: Math.round(result[`price_${i}`] * 100) / 100,
              count: Math.round(result[`count_${i}`] * 100) / 100,
              change: Math.round(result[`change_${i}`] * 100) / 100,
              change_abs: Math.round(result[`change_abs_${i}`] * 100) / 100,
              change_percent_abs: Math.round(result[`change_percent_abs_${i}`] * 100) / 100,
              change_period_ms: whenMs - changeSinceMsArray[i],
              change_sign: result[`change_${i}`] >= 0 ? '+' : '-',
            };
            delete result[`price_${i}`];
            delete result[`count_${i}`];
            delete result[`change_${i}`];
            delete result[`change_abs_${i}`];
            delete result[`change_percent_abs_${i}`];
          });
        }
      });
      return resolve(results);
    }));
};
