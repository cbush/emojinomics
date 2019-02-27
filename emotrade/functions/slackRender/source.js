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
  ].join(' ');
}

function renderHolding(h) {
  return [
    renderEmoji(h.emoji),
    `x ${h.count}`,
    `@ ${renderChucklebucks(h.price)}`,
    '=',
    `$${h.total_value.toFixed(2)}`,
    '|',
    `${h.portfolio_percent.toFixed(1)}%`,
    '|',
    `:book: ${renderChucklebucks(h.book_value)}`,
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
  };
  return renderFunctions[type](model);
};
