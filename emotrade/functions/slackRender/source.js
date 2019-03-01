const MAX_NAME_LENGTH = 12;

function commafy(num) {
  // Number.toLocaleString() and lookahead regexes don't work.
  var parts = (''+(num<0?-num:num)).split("."), s=parts[0], L, i=L= s.length, o='';
  while(i--){ o = (i===0?'':((L-i)%3?'':',')) +s.charAt(i) +o }
  return (num<0?'-':'') + o + (parts[1] ? '.' + parts[1] : ''); 
}

function renderNumber(n) {
  return commafy(n);
}

function renderChucklebucks(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}\$${renderNumber(Math.abs(value).toFixed(2))}`;
}

function renderEmoji(emoji) {
  const display_size = 12;
  return `:${emoji}: \`${emoji.ellipsize(MAX_NAME_LENGTH).padEnd(MAX_NAME_LENGTH)}\``;
}

function renderReactPower(p) {
  return `${renderEmoji(p.emoji)}: :fist: ${p.value}`;
}

function renderPrice(p) {
  const {change, change_percent} = p;
  const change_arrow = change >= 0.01 ? ':arrow_up_small::chart_with_upwards_trend:' : change > -0.01 ? ':arrow_right::equal:' : ':arrow_down_small::chart_with_downwards_trend:';
  const change_spice = change_percent > 50
    ? ':rotating_light:'
      : change_percent > 25
        ? ':fire:'
          : change_percent > 10
            ? ':hot_pepper:' : undefined;
  return [
    `${renderEmoji(p.emoji)}`,
    `${change_arrow}${change_spice || ''}`,
    `\$${p.price.toFixed(2)}`,
    `(${p.change_sign}${p.change_abs.toFixed(2)})`,
    `(${p.change_sign}${p.change_percent.toFixed(1)}%)`,
    `${p.count} (${((p.count / 3000) * 100).toFixed(2)}%)`,
  ].join(' ');
}

function renderEmojiCountAtPrice({
  emoji, count, price,
}) {
  return [
    renderEmoji(emoji),
    `x ${count}`,
    `@ ${renderChucklebucks(price)}`,
    '=',
    renderChucklebucks(count * price),
  ].join(' ');
}

function renderHolding(h) {
  return [
    renderEmojiCountAtPrice({emoji: h.emoji, count: h.count, price: h.price}),
    '|',
    `${h.portfolio_percent.toFixed(1)}%`,
    '|',
    `:book: ${renderChucklebucks(h.book_value)}`,
    `- :money_mouth_face: ${renderChucklebucks(h.fees_paid || 0)}`,
    `= ${renderChucklebucks(h.book_value - (h.fees_paid || 0))}`,
  ].join(' ');
}

function renderHoldings(h) {
  return h.map(renderHolding);
}

function renderTrade(t) {
}

function renderPortfolio(p) {
  const cash = p.cash;
  const holdingTexts = renderHoldings(p.holdings);
  const portfolioText = holdingTexts.join('\n') || "<nothing yet>";
  const cashText = renderChucklebucks(cash);
  const netWorth = p.net_worth;
  const netWorthText = renderChucklebucks(netWorth);
  return `*Net worth:*
${netWorthText}

*Chucklebucks cash holdings:*
${cashText}

*Portfolio:*
${portfolioText}
`;
}

function renderPortfolioBrief(p) {
  p.holdings.sort((a, b) => {
    return b.portfolio_percent - a.portfolio_percent;
  });
  let topEmoji = p.holdings.map(holding => `:${holding.emoji}: ${holding.portfolio_percent.toFixed(1)}%`);
  topEmoji = topEmoji.slice(0, 5);
  topEmoji = topEmoji.join(' ');
  const display_name = p.display_name || p.user;
  return [
    `\`${display_name.ellipsize(15).padEnd(15)}\``,
    renderChucklebucks(p.net_worth),
    `${topEmoji}`,
    '|',
    `${renderNumber(p.shares_traded)} traded | ${renderNumber(p.trade_count)} trades`,
  ].join(' ');
}

function renderTradeReceipt(r) {
  return [
    ...r.notes,
    `*Dry run:* ${r.dry_run ? 'yes' : 'no'}`,
    `${r.action.toUpperCase()} ${renderEmojiCountAtPrice(r)}`,
    '',
    `:money_mouth_face: *Fees:* ${renderChucklebucks(r.fee)}`,
    `:heavy_minus_sign: *Subtotal:* ${renderChucklebucks(r.count * r.price + r.fee)}`,
    `:moneybag: *Cash:* ${renderChucklebucks(r.cash_before)} -> ${renderChucklebucks(r.cash_after)}`,
    `*Holding:* ${r.holding_count_before} -> ${r.holding_count_after}`,
  ].join('\n');
}

exports = function(type, model) {
  context.functions.execute('polyfills');

  const renderFunctions = {
    price: renderPrice,
    emoji: renderEmoji,
    holding: renderHolding,
    trade: renderTrade,
    portfolio: renderPortfolio,
    portfolioBrief: renderPortfolioBrief,
    number: renderNumber,
    reactPower: renderReactPower,
    tradeReceipt: renderTradeReceipt,
  };
  return renderFunctions[type](model);
};
