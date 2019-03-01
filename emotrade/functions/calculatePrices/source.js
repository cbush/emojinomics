const REACT_COUNT = 5000; // number of reacts considered in the price
const GAIN_PER_REACT = 0.39; // react power

function priceAgg() {
  return {
    $multiply: [
      '$count',
      GAIN_PER_REACT,
    ],
  };
}

exports = async function({team_id, emojis, $sort, $limit}) {
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('reactions');

  const pipeline = [
    {$match: {team_id}},
    {$sort: {team_id: 1, ts: -1}}, // not sure if team_id is needed to leverage index on sort
    {$limit: REACT_COUNT}, // limit to max considerable reacts
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
      value: {$sum: '$value'},
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
