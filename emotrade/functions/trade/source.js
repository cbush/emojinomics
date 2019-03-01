const MIN_FEE_BUCKS = 0;
const PER_SHARE_FEE_BUCKS = 0.49;

function calculateFee(count) {
  if (count === 0) {
    return 0;
  }
  return Math.max(MIN_FEE_BUCKS, count * PER_SHARE_FEE_BUCKS);
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
    fee,
    count,
    price,
    book_value,
    fees_paid,
    dry_run,
    cash_before,
    holding_count_before,
  } = trade;
  console.log('makeTrade', count);
  const is_buy = action === 'buy'; // otherwise is_sell

  const holding_count_delta = is_buy ? count : -count;

  // change in chucklebucks cash holdings
  const cash_delta = -holding_count_delta * price - fee;

  // change in holding's book value
  const book_value_delta = count * (is_buy ? price : -book_value);

  // change in holding's previous fees
  const fee_delta = is_buy ? +fee : fee - (fees_paid / holding_count_before) * count;

  if (!dry_run && count > 0) {
    await collection.insertOne({
      user_id,
      team_id,
      app_id,
      emoji,
      count: holding_count_delta,
      buy_price: price, // unit price paid
      fee,
      cash_delta,
      book_value_delta,
      fee_delta,
      ts: new Date().getTime(),
    });
    console.log('done!');
  }

  trade.cash_after = cash_before + cash_delta;
  trade.holding_count_after = holding_count_before + holding_count_delta;

  if (!is_buy) {
    const bought_at = count * price + fee;
    const sold_for = count * book_value - fees_paid;
    trade.profit = bought_at - sold_for;
  }

  return trade;
}

async function buy(trade) {
  console.log('buy');
  const {
    cash_before,
    emoji,
    notes,
    price,
  } = trade;
  let count = trade.requested_count;

  const price_with_fee = price + PER_SHARE_FEE_BUCKS;
  let can_afford = Math.max(0, Math.floor(cash_before / price_with_fee));
  let can_afford_fee = calculateFee(can_afford);
  while (can_afford > 0 && ((can_afford * price + can_afford_fee) > cash_before)) { // min fee applied
    --can_afford;
    can_afford_fee = calculateFee(can_afford);
  }

  if (can_afford === 0) {
    notes.push(`You can't afford any :${emoji}: *${emoji}*: @ $${price.toFixed(2)} (with fee of $${PER_SHARE_FEE_BUCKS.toFixed(2)}) exceeds available cash ($${cash_before.toFixed(2)}).`);
    count = 0;
  } else if (count === 'all') {
    notes.push(`Buy all: you can afford ${can_afford}.`);
    count = can_afford;
  } else if (count > can_afford) {
    notes.push(`You can only afford ${can_afford}.`);
    count = can_afford;
  }

  trade.count = count;
  trade.fee = calculateFee(count);
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

  let fee = calculateFee(count);
  let cash_after_sale = trade.cash_before + count * trade.price - fee;
  while ((count > 0) && (cash_after_sale < 0)) {
    // TODO: Calculate the intersections of the cash-after-sale function with 0,
    // or do this as a binary search. How do I math?
    --count;
    fee = calculateFee(sale_count);
    cash_after_sale = trade.cash_before + count * trade.price - fee;
  }

  trade.count = count;
  trade.fee = fee;

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
        trade.fees_paid = (holding && holding.fees_paid) || 0;
        trade.book_value = (holding && (holding.book_value / holding.count)) || undefined;
      
        return command(trade);
      });
  });
};
