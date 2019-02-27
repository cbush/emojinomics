exports = function(user_id) {
  return context.functions.execute('getPortfolios', {
    users: [user_id],
  }).then(portfoliosByUser => new Promise((resolve) => {
    resolve(portfoliosByUser[user_id]);
  }));
};
