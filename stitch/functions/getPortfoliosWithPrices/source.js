function applyPricesToHoldings(holdings, valuations) {
  holdings.map((holding) => {
    let price = 1;
    let previous_price;
    for (let i in valuations) {
      if (valuations[i].emoji === holding.emoji) {
        price = valuations[i].price;
        previous_price = valuations[i].previous_price;
        break;
      }
    }
    holding.price = price;
    holding.total_value = price * holding.count;
    
    if (previous_price) {
      holding.previous_price = previous_price;
      holding.previous_total_value = previous_price * holding.previous_count;
    }
  });
}

function getHoldingsTotalValue(holdings, getPrice) {
  let total_value = 0;
  holdings.map((holding) => {
    total_value += getPrice(holding);
  });
  return total_value;
}

function applyPortfolioPercentToHoldings(holdings, portfolio) {
  holdings.map((holding) => {
    holding.portfolio_percent = Math.round((holding.total_value / portfolio.net_worth) * 1000) / 10;
    
    if (holding.previous_total_value !== undefined && portfolio.previous_net_worth !== undefined) {
      holding.previous_portfolio_percent = Math.round((holding.previous_total_value / portfolio.previous_net_worth) * 1000) / 10;
    }
  });
}

function applyPricesToPortfolios({portfoliosByUser, whenMs, changeSinceMs}) {
  const emojisHeldMap = {};
  for (let i in portfoliosByUser) {
    const portfolio = portfoliosByUser[i];
    for (let j in portfolio.holdings) {
      const holding = portfolio.holdings[j];
      emojisHeldMap[holding.emoji] = true;
    }
  }
  const emojisHeld = [];
  for (let emoji in emojisHeldMap) {
    emojisHeld.push(emoji);
  }
  
  if (whenMs === undefined) {
    whenMs = new Date().getTime(); // now
  }
  return context.functions.execute('getPrices', {
    emojis: emojisHeld,
    whenMs,
    changeSinceMs,
  }).then((valuations) => new Promise((resolve, reject) => {
      for (let i in portfoliosByUser) {
        const portfolio = portfoliosByUser[i];

        applyPricesToHoldings(portfolio.holdings, valuations);
        portfolio.net_worth = portfolio.cash + getHoldingsTotalValue(portfolio.holdings, h => h.total_value);

        if (changeSinceMs !== undefined) {
          portfolio.previous_net_worth = portfolio.cash + getHoldingsTotalValue(portfolio.holdings, h => h.previous_total_value);
        }
        applyPortfolioPercentToHoldings(portfolio.holdings, portfolio);
      }
      return resolve(portfoliosByUser);
    }));
}

exports = function(args) {
  const {whenMs, changeSinceMs} = args;
  return context.functions.execute('getPortfolios', args)
    .then((portfoliosByUser) => applyPricesToPortfolios({portfoliosByUser, whenMs, changeSinceMs}));
};
