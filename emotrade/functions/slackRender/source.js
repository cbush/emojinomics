const MAX_NAME_LENGTH = 12;

// from SO user esmiralha
function hash(string) {
  let hash = 0;
  let i;
  let chr;
  if (string.length === 0) return hash;
  for (i = 0; i < string.length; i++) {
    chr = string.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash = Math.abs(parseInt(hash % Math.pow(2, 31), 10));
  }
  return hash;
}

function commafy(num) {
  // Number.toLocaleString() and lookahead regexes don't work.
  const parts = (`${num < 0 ? -num : num}`).split('.'); const s = parts[0]; let L; let i = L = s.length; let
    o = '';
  while (i--) { o = (i === 0 ? '' : ((L - i) % 3 ? '' : ',')) + s.charAt(i) + o; }
  return (num < 0 ? '-' : '') + o + (parts[1] ? `.${parts[1]}` : '');
}

function renderPseudonymizedUser(id) {
  const icons = [
    'cat',
    'dog',
    'mouse',
    'hamster',
    'rabbit',
    'wolf',
    'frog',
    'tiger',
    'koala',
    'bear',
    'pig',
    'cow',
    'boar',
    'monkey',
    'horse',
    'racehorse',
    'camel',
    'sheep',
    'elephant',
    'panda_face',
    'snake',
    'bird',
    'baby_chick',
    'hatched_chick',
    'hatching_chick',
    'chicken',
    'penguin',
    'turtle',
    'bug',
    'honeybee',
    'ant',
    'beetle',
    'snail',
    'octopus',
    'tropical_fish',
    'fish',
    'whale',
    'whale2',
    'dolphin',
    'cow2',
    'ram',
    'rat',
    'water_buffalo',
    'tiger2',
    'rabbit2',
    'dragon',
    'goat',
    'rooster',
    'dog2',
    'pig2',
    'mouse2',
    'ox',
    'blowfish',
    'crocodile',
    'dromedary_camel',
    'leopard',
    'cat2',
    'poodle',
  ];
  return `:${icons[hash(id) % icons.length]}:`;
}

function renderNumber(n) {
  return commafy(n);
}

function renderChucklebucks(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${renderNumber(Math.abs(value).toFixed(2))}`;
}

function renderChangeArrow({change}) {
  if (change >= 0.01) {
    return ':arrow_up_small::chart_with_upwards_trend:';
  }
  if (change > -0.01) {
    return ':arrow_right::equal:';
  }
  return ':arrow_down_small::chart_with_downwards_trend:';
}

function renderChangeSpice({change_percent_abs}) {
  if (change_percent_abs > 50) {
    return ':rotating_light:';
  }
  if (change_percent_abs > 25) {
    return ':fire:';
  }
  if (change_percent_abs > 10) {
    return ':hot_pepper:';
  }
  return '';
}

function renderEmoji(emoji) {
  return [
    `:${emoji}:`,
    `\`${emoji.ellipsize(MAX_NAME_LENGTH).padEnd(MAX_NAME_LENGTH)}\``,
  ].join(' ');
}

function renderPrice(p) {
  return [
    `${renderEmoji(p.emoji)}`,
    `${renderChangeArrow(p)}${renderChangeSpice(p)}`,
    `$${p.price.toFixed(2)}`,
    `(${p.change_sign}${p.change_abs.toFixed(2)})`,
    `(${p.change_sign}${p.change_percent_abs.toFixed(1)}%)`,
  ].join(' ');
}

function renderEmojiCountAtPrice({
  emoji, count, price, change, change_percent_abs,
}) {
  return [
    renderEmoji(emoji) + (change !== undefined ? ` ${renderChangeArrow({change})}${renderChangeSpice({change_percent_abs})}` : ''),
    `x ${count}`,
    `@ ${renderChucklebucks(price)}`,
    '=',
    renderChucklebucks(count * price),
  ].join(' ');
}

function renderProfit(profit) {
  if (profit < 0) {
    return `:money_with_wings:LOSS ${renderChucklebucks(profit)}`;
  }
  return `:moneybag:PROFIT ${renderChucklebucks(profit)}`;
}

function renderHolding(h) {
  const profit = h.total_value - h.book_value;
  let book;
  if (profit > 0) {
    book = 'green_book';
  } else {
    book = 'orange_book';
  }
  return [
    renderEmojiCountAtPrice({
      ...h,
    }),
    '|',
    `:${book}: ${renderChucklebucks(h.book_value)}`,
    '|',
    `${h.portfolio_percent.toFixed(1)}%`,
  ].join(' ');
}

function renderHoldings(h) {
  return h.map(renderHolding);
}

function renderTrade(t) {
  const {
    emoji, count,
  } = t;
  const action = count > 0 ? 'BUY' : 'SELL';
  let profit;
  if (action === 'SELL') {
    profit = `(${renderProfit(t.profit)})`;
  }
  return [
    renderPseudonymizedUser(t.user_id),
    `*${action}*`,
    renderEmojiCountAtPrice({emoji, count: Math.abs(count), price: t.buy_price}),
    profit,
  ].join(' ');
}

function renderPortfolio(p) {
  const {
    cash, profit,
  } = p;
  const holdingTexts = renderHoldings(p.holdings);
  const portfolioText = holdingTexts.join('\n') || '<nothing yet>';
  const cashText = renderChucklebucks(cash);
  const netWorth = p.net_worth;
  const netWorthText = renderChucklebucks(netWorth);
  return `*:chart_with_upwards_trend: Net worth:*
${netWorthText}

*:money_with_wings: All-time profits:*
${renderChucklebucks(profit)}

*:moneybag: Chucklebucks cash holdings:*
${cashText}

*:books: Positions:*
${portfolioText}
`;
}

function renderPortfolioBrief(p) {
  p.holdings.sort((a, b) => b.portfolio_percent - a.portfolio_percent);
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
  let notes;
  if (r.notes.length !== 0) {
    notes = [
      '*Note:*',
      ...r.notes,
      '',
    ].join('\n');
  }
  return [
    notes,
    `${r.action.toUpperCase()} ${renderEmojiCountAtPrice(r)}`,
    '',
    `:moneybag: *Cash:* ${renderChucklebucks(r.cash_before)} -> ${renderChucklebucks(r.cash_after)}`,
    `*Holding:* ${r.holding_count_before} -> ${r.holding_count_after}`,
  ].join('\n');
}

exports = function(type, model) {
  context.functions.execute('polyfills');

  const renderFunctions = {
    emoji: renderEmoji,
    holding: renderHolding,
    number: renderNumber,
    portfolio: renderPortfolio,
    portfolioBrief: renderPortfolioBrief,
    price: renderPrice,
    trade: renderTrade,
    tradeReceipt: renderTradeReceipt,
  };
  return renderFunctions[type](model);
};
