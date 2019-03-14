let REACTS_CONSIDERED_IN_PRICE; // number of reacts considered in the price
let GAIN_PER_REACT; // react power
let BASE_PRICE;

function priceAgg() {
  return {
    $add: [
      BASE_PRICE,
      {
        $multiply: [
          '$value',
          GAIN_PER_REACT,
        ],
      },
    ],
  };
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

  const pipeline = [
    {$match: {team_id}},
    {$sort: {team_id: 1, ts: -1}}, // not sure if team_id is needed to leverage index on sort
    {$limit: REACTS_CONSIDERED_IN_PRICE}, // limit to max considerable reacts
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
      value: {$sum: {$cond: {if: {$eq: ['$value', 0]}, then: 0, else: {$divide: ['$value', {$abs: '$value'}]}}}},
    },
  });

  pipeline.push({
    $project: {
      _id: 0,
      emoji: '$_id',
      price: priceAgg(),
      count: 1,
      value: 1,
    },
  });

  if ($sort !== undefined) {
    pipeline.push({$sort});
  }

  if ($limit !== undefined) {
    pipeline.push({$limit});
  }

  const results = await collection.aggregate(pipeline).toArray();

  results.forEach((result) => {
    result.price = Math.round(result.price * 100) / 100;

    // Temporary: to remove
    result.previous_price = 0;
    result.change_period_ms = 0;
    result.change = 0;
    result.change_sign = '';
    result.change_percent = 0;
    result.change_abs = 0;
  });
  return results;
};
