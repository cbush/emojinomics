exports = ({
  team_id,
  name,
  limit = 10,
  whenMs = new Date().getTime(),
  changeSinceMs,
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
  changeSinceMs = changeSinceMs || (whenMs - (name === 'hot' ? 1 : 3) * 24 * 60 * 60 * 1000);
  return context.functions.execute('getPrices', {
    team_id, $sort, $limit, whenMs, changeSinceMs,
  })
    .then((prices) => {
      const list = {
        name,
        prices,
      };
      return resolve(list);
    })
    .catch(reject);
});
