function applyPricesToHoldings(holdings, valuations) {
  holdings.forEach((holding) => {
    const valuation = valuations.find(valuation => valuation.emoji === holding.emoji);

    let price = 0;
    let previous_price;

    if (valuation !== undefined) {
      price = valuation.price;
      previous_price = valuation.previous_price;
    }
    holding.price = price;
    holding.total_value = price * holding.count;

    if (previous_price !== undefined) {
      holding.previous_price = valuation.previous_price;
      holding.previous_total_value = valuation.previous_price * holding.previous_count;
    }
    holding.valuation = valuation;
  });
}

function getHoldingsTotalValue(holdings, getPrice) {
  let total_value = 0;
  holdings.forEach((holding) => {
    total_value += getPrice(holding);
  });
  return total_value;
}

function applyPortfolioPercentToHoldings(holdings, portfolio) {
  holdings.forEach((holding) => {
    holding.portfolio_percent = Math.round((holding.total_value / portfolio.net_worth) * 1000) / 10;

    if (holding.previous_total_value !== undefined && portfolio.previous_net_worth !== undefined) {
      holding.previous_portfolio_percent = Math.round((holding.previous_total_value / portfolio.previous_net_worth) * 1000) / 10;
    }
  });
}

function applyPricesToPortfolios({
  team_id,
  portfoliosByUser,
  whenMs,
  changeSinceMs,
}) {
  const emojisHeldMap = {};
  Object.values(portfoliosByUser).forEach((portfolio) => {
    portfolio.holdings.forEach((holding) => {
      emojisHeldMap[holding.emoji] = true;
    });
  });
  const emojisHeld = Object.keys(emojisHeldMap);

  if (whenMs === undefined) {
    whenMs = new Date().getTime(); // now
  }
  return context.functions.execute('getPrices', {
    team_id,
    emojis: emojisHeld,
    whenMs,
    changeSinceMs,
  }).then((valuations) => {
    Object.values(portfoliosByUser).forEach((portfolio) => {
      applyPricesToHoldings(portfolio.holdings, valuations);
      portfolio.net_worth = portfolio.cash + getHoldingsTotalValue(portfolio.holdings, h => h.total_value);

      if (changeSinceMs !== undefined) {
        portfolio.previous_net_worth = portfolio.cash + getHoldingsTotalValue(portfolio.holdings, h => h.previous_total_value);
      }
      applyPortfolioPercentToHoldings(portfolio.holdings, portfolio);
    });
    return portfoliosByUser;
  });
}

exports = function(args) {
  context.functions.execute('polyfills');
  const {team_id, whenMs, changeSinceMs} = args;
  return context.functions.execute('getPortfolios', args)
    .then(portfoliosByUser => applyPricesToPortfolios({
      team_id,
      portfoliosByUser,
      whenMs,
      changeSinceMs,
    }));
};
