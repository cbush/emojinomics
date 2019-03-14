let REACTS_CONSIDERED_IN_PRICE; // number of reacts considered in the price
let GAIN_PER_REACT; // react power
let BASE_PRICE;

function sumValuesIfAgg(cond) {
  return {
    $sum: {
      $cond: {
        if: {
          $and: [
            {$ne: ['$value', 0]},
            cond,
          ],
        },
        then: {$divide: ['$value', {$abs: '$value'}]},
        else: 0,
      },
    },
  };
}

function truncAgg(agg) {
  return {
    $divide: [
      {
        $trunc: {
          $multiply: [
            agg,
            100,
          ],
        },
      },
      100,
    ],
  };
}

function priceAgg(name) {
  return truncAgg({
    $add: [
      BASE_PRICE,
      {
        $multiply: [
          name,
          GAIN_PER_REACT,
        ],
      },
    ],
  });
}

exports = async function({
  team_id, emojis, $sort, $limit,
}) {
  const rules = context.values.get('rules');
  GAIN_PER_REACT = rules.GAIN_PER_REACT;
  REACTS_CONSIDERED_IN_PRICE = rules.REACTS_CONSIDERED_IN_PRICE;
  BASE_PRICE = rules.BASE_PRICE;

  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('reactions');

  const $match = {team_id};
  const sort = {team_id: 1, ts: -1}; // not sure if team_id is needed to leverage index on sort

  // Aggregating both previous and current prices in one:
  //
  // Price is based on last N reacts up to a limit, not a time period.
  // Not sure if it's possible to get the current overall entry index while
  // grouping, so there's a quick lookup to get a couple key timestamps (ts):
  // the oldest ts of the current set and latest ts of the previous set.
  //
  // Then:
  // - Include reacts in the current price if they're newer than oldest_current_ts
  // - Include reacts in the previous price if they're older than newest_previous_ts
  //
  // The query limit -- and 'now' being inherently the latest react ts -- provide
  // the other bounds for each set. (Note the reacts are ordered by ts descending.)
  // Up to REACTS_CONSIDERED_IN_PRICE are considered in each set (fewer are
  // considered if the data is just not available yet).
  //
  // Older                                          Newer
  // --> --> --> --> --> --> TIME --> --> --> --> --> -->
  // LIMIT       CURR_OLDEST      PREV_NEWEST         NOW
  // |             |                   |               |
  // v             v                   v               v
  // |-------------|-------------------|---------------|
  // | :) :) :) :) | :) :) :) :) :) :) | :) :) :) :) :)| <-- Reacts in collection
  // `--- considered in prev. price ---`               |
  //               `---- considered in curr. price ----`

  let skip = REACTS_CONSIDERED_IN_PRICE / 10;

  const results = await collection
    .find($match, {ts: 1})
    .sort(sort)
    .limit(REACTS_CONSIDERED_IN_PRICE)
    .toArray();

  if (results.length === 0) {
    return [];
  }

  skip = Math.min(results.length, skip);

  const newest_previous_ts = results[skip - 1].ts;
  const oldest_current_ts = results[results.length - 1].ts;

  const pipeline = [
    {$match},
    {$sort: sort},
    {$limit: REACTS_CONSIDERED_IN_PRICE + skip}, // limit to max considerable reacts
  ];

  if (emojis !== undefined) {
    pipeline.push({
      $match: emojis.length === 1 ? {emoji: emojis[0]} : {$expr: {$in: ['$emoji', emojis]}},
    });
  }

  pipeline.push({
    $group: {
      _id: '$emoji',
      count: {$sum: '$type'},
      value: sumValuesIfAgg({$gte: ['$ts', oldest_current_ts]}),
      previous_value: sumValuesIfAgg({$lte: ['$ts', newest_previous_ts]}),
    },
  });

  pipeline.push({
    $project: {
      _id: 0,
      count: 1,
      value: 1,
      emoji: '$_id',
      price: priceAgg('$value'),
      previous_price: priceAgg('$previous_value'),
    },
  });

  pipeline.push({
    $project: {
      emoji: 1,
      count: 1,
      value: 1,
      price: 1,
      previous_price: 1,
      change_period_ms: newest_previous_ts,
      change: {$subtract: ['$price', '$previous_price']},
      change_percent: truncAgg({
        $multiply: [{
          $subtract: [{
            $divide: [
              '$price',
              '$previous_price',
            ],
          },
          1,
          ],
        },
        100,
        ],
      }),
      change_sign: {
        $cond: {
          if: {$gte: ['$price', '$previous_price']},
          then: '+',
          else: '-',
        },
      },
    },
  });
  pipeline.push({
    $project: {
      emoji: 1,
      count: 1,
      value: 1,
      price: 1,
      previous_price: 1,
      change_period_ms: 1,
      change: 1,
      change_percent: 1,
      change_sign: 1,
      change_abs: {$abs: '$change'},
      change_percent_abs: {$abs: '$change_percent'},
    },
  });
  if ($sort !== undefined) {
    pipeline.push({$sort});
  }

  if ($limit !== undefined) {
    pipeline.push({$limit});
  }

  return collection.aggregate(pipeline).toArray();
};
