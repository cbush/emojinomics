function getInsiderTradingFine(trade) {
  const crime_probability = context.functions.execute('detectInsiderTrading', {
    ...trade,
    last_transaction: ((trade.holding && trade.holding.last_transaction) || undefined),
  });
  if (crime_probability === 0) {
    return 0;
  }

  if (Math.random() > crime_probability) {
    return 0;
  }

  const {
    price, book_value, count,
  } = trade;
  const unit_profit = price - book_value;
  return unit_profit * count;
}

async function makeTrade(trade) {
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('trades');

  const {
    action,
    user_id,
    team_id,
    app_id,
    emoji,
    count,
    price,
    book_value,
    dry_run,
    cash_before,
    holding_count_before,
    notes,
  } = trade;

  const is_buy = action === 'buy'; // otherwise is_sell

  const holding_count_delta = is_buy ? count : -count;

  // change in chucklebucks cash holdings
  const cash_delta = -holding_count_delta * price;

  // change in holding's book value
  const book_value_delta = count * (is_buy ? price : -book_value);

  trade.cash_after = cash_before + (count === 0 ? 0 : cash_delta);
  trade.holding_count_after = holding_count_before + holding_count_delta;

  if (count === 0) {
    return trade;
  }

  const document = {
    user_id,
    team_id,
    app_id,
    emoji,
    count: holding_count_delta,
    buy_price: price, // unit price paid
    cash_delta,
    book_value_delta,
    ts: new Date().getTime(),
  };

  const fine = getInsiderTradingFine(trade);
  if (fine) {
    trade.crime = true;
    trade.fine = fine;
    document.crime = true;
    document.fine = fine;
    notes.push(':sleuth_or_spy::female-police-officer: The SEC suspects you of insider trading and fines away all of your profit!');
  }

  if (!is_buy) {
    const bought_at = count * book_value;
    const sold_for = count * price;
    trade.profit = sold_for - bought_at - fine;
  }
  document.profit = trade.profit;

  if (!dry_run && count > 0) {
    await collection.insertOne(document);
  }

  return trade;
}

async function buy(trade) {
  const {
    cash_before,
    emoji,
    notes,
    price,
  } = trade;
  let count = trade.requested_count;

  const can_afford = Math.max(0, Math.floor(cash_before / price));

  if (can_afford === 0) {
    notes.push(`You can't afford any :${emoji}: *${emoji}*: @ $${price.toFixed(2)} exceeds available cash ($${cash_before.toFixed(2)}).`);
    count = 0;
  } else if (count === 'all') {
    notes.push(`Buy all: you can afford ${can_afford}.`);
    count = can_afford;
  } else if (count > can_afford) {
    notes.push(`You can only afford ${can_afford}.`);
    count = can_afford;
  }

  trade.count = count;
  return makeTrade(trade);
}

async function sell(trade) {
  const {notes} = trade;

  let count = trade.requested_count;
  const can_sell = trade.holding_count_before;
  if (count === 'all') {
    notes.push(`Sell all: you have ${can_sell} to sell.`);
    count = can_sell;
  } else if (can_sell === 0) {
    notes.push('You have none to sell.');
    count = 0;
  } else if (count > can_sell) {
    notes.push(`You only have ${can_sell} to sell.`);
    count = can_sell;
  }

  trade.count = count;

  return makeTrade(trade);
}

exports = function({
  action, // 'buy' or 'sell'
  emoji,
  count,
  app_id,
  team_id,
  user_id,
  dry_run,
}) {
  context.functions.execute('polyfills');

  if (count !== 'all' && (!Number.isInteger(count) || count <= 0)) {
    throw new Error(`Expected count to be an integer > 0 or the string 'all', got '${count}'`);
  }

  let command;
  switch (action) {
  case 'buy': command = buy; break;
  case 'sell': command = sell; break;
  default: throw new Error(`Invalid action: ${action}. Options are 'buy', 'sell'`);
  }

  const trade = {
    app_id,
    team_id,
    user_id,
    action,
    emoji,
    requested_count: count,
    dry_run,
    notes: [],
  };

  return context.functions.execute('calculatePrices', {
    team_id,
    emojis: [emoji],
  }).then((prices) => {
    if (prices.length === 0) {
      trade.notes.push(`Emoji not listed: ${emoji}. Try reacting with it to register it.`);
      trade.sale_count = 0;
      return trade;
    }

    trade.price = prices[0].price;

    return context.functions.execute('getPortfolio', user_id)
      .then((portfolio) => {
        trade.cash_before = portfolio.cash;

        const {holdings} = portfolio;
        const holding = holdings.find(h => h.emoji === emoji);
        trade.holding_count_before = (holding && holding.count) || 0;
        trade.book_value = (holding && (holding.book_value / holding.count)) || undefined;
        trade.holding = holding;

        return command(trade);
      });
  });
};
