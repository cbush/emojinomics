exports = function({
  team_id,
  emojis,
  $sort,
  $limit,
  skip,
}) {
  // TODO: Eventually replace with prices snapshot?
  return context.functions.execute('calculatePrices', {
    team_id,
    emojis,
    $sort,
    $limit,
    skip,
  });
};
