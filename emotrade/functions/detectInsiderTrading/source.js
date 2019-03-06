
// Returns a probability that the police will bust the trade.
// Busting a trade doesn't mean that cheating actually happened.
// Likewise, cheater trades may go unpunished.
exports = function({
  action, // 'buy' or 'sell'
  price,
  book_value, // unit book value
  last_transaction, // last transaction on the holding
}) {
  if (action !== 'sell') {
    return 0;
  }

  const {INSIDER_TRADING_THRESHOLD, GAIN_PER_REACT} = context.values.get('rules');

  const unit_profit = price - book_value;
  if (unit_profit <= 0) {
    return 0;
  }

  if (unit_profit > INSIDER_TRADING_THRESHOLD * GAIN_PER_REACT) {
    return 0;
  }

  const now = new Date().getTime();
  const last_week = now - 7 * 24 * 60 * 60 * 1000;
  if (last_transaction < last_week) {
    return 0;
  }

  // probability of being busted is inversely proportional to time since last transaction
  return (last_transaction - last_week) / (now - last_week);
};
