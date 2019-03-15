exports = ({
  team_id,
  name,
  limit = 10,
}) => new Promise((resolve, reject) => {
  let $sort;
  switch (name) {
  case 'top':
    $sort = {price: -1};
    break;
  case 'hot':
    $sort = {change_percent_abs: -1};
    break;
  case 'bigmoney':
    $sort = {change_abs: -1};
    break;
  default: {
    const admonition = name === 'help' ? '' : `Unknown list: \`${name}\`. `;
    return reject(new Error(`${admonition}*Options are:*
- top: highest price
- hot: biggest % change in 24 hours
- bigmoney: biggest $ change in 24 hours`));
  }
  }
  const $limit = limit || 10;
  return context.functions.execute('getPrices', {
    team_id, $sort, $limit,
  }).then(prices => resolve({
    name,
    prices,
  }));
});
