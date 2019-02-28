let client;
let db;
let TOKEN;
let SLACK_EMOTRADE_CHANNEL_URL;

function isValidSaleCount(str) {
  return str === 'all' || /^([1-9]\d*)$/.test(str);
}

function renderPrice(model) {
  return context.functions.execute('slackRender', 'price', model);
}

function renderReactPower(model) {
  return context.functions.execute('slackRender', 'reactPower', model);
}

function renderPortfolio(model) {
  return context.functions.execute('slackRender', 'portfolio', model);
}

function renderPortfolioBrief(model) {
  return context.functions.execute('slackRender', 'portfolioBrief', model);
}

function getCurrentPrices(args) {
  const now = new Date().getTime();
  args.whenMs = now;
  return context.functions.execute('getPrices', args);
}

function getPortfolio(user_id) {
  return context.functions.execute('getPortfolio', user_id);
}

function getPortfoliosWithPrices(users) {
  return context.functions.execute('getPortfoliosWithPrices', {users});
}

function portfolioResponse(portfolio) {
  return {
    response_type: 'ephemeral',
    text: renderPortfolio(portfolio),
  };
}

function me({query}) {
  const {user_id} = query;
  return getPortfoliosWithPrices([user_id])
    .then(portfoliosByUser => portfolioResponse(portfoliosByUser[user_id]));
}

function makeTrade({
  user_id, emoji, price, count, book_value,
}) {
  const collection = db.collection('trades');
  book_value = count > 0 ? -price : -book_value;
  return collection.insertOne({
    user_id,
    emoji,
    count,
    cash_delta: -count * price,
    book_value_delta: -count * book_value,
    buy_price: price,
    timestamp: new Date().getTime(),
  }).then(result => new Promise((resolve) => {
    const tradeType = count < 0 ? 'SELL' : 'BUY';
    const saleCount = Math.abs(count);
    let profit = '';
    if (count < 0) {
      const change = saleCount * price - saleCount * -book_value;
      const sign = change >= 0 ? '+' : '-';
      const profitOrLoss = sign === '+' ? 'PROFIT :moneybag:' : 'LOSS :money_with_wings:';
      profit = ` (${profitOrLoss} ${sign}$${Math.abs(change).toFixed(2)})`;
    }
    const slack = context.services.get('Slack');
    slack.post({
      url: SLACK_EMOTRADE_CHANNEL_URL,
      body: {
        text: `${tradeType} ${saleCount} x :${emoji}: ${emoji} @ $${price.toFixed(2)} = $${(price * saleCount).toFixed(2)}${profit}`,
      },
      encodeBodyAsJSON: true,
    });
    resolve(result);
  }));
}

function tradeReceiptResponse({
  count, emoji, price, cash, admonition,
}) {
  const saleCount = Math.abs(count);
  const cashDeltaSign = count > 0 ? '-' : '+';
  const tradeType = cashDeltaSign === '-' ? 'BUY' : 'SELL';
  return {
    response_type: 'ephemeral',
    text:
`${admonition}${tradeType} ${saleCount} :${emoji}: ${emoji} @ $${price.toFixed(2)}
\`prev. cash:\` $${cash.toFixed(2)}
\`sale total:\` ${cashDeltaSign}$${(saleCount * price).toFixed(2)}
\`curr. cash:\` $${(cash - count * price).toFixed(2)}
`,
  };
}

function emojiNotFoundResponse(emoji) {
  return {
    response_type: 'ephemeral',
    text:
`*Emoji not found:* '${emoji}'

Hints:
- make sure the emoji exists
- use lowercase spelling
- try reacting with it to register it in the market
`,
  };
}

function getEmojiName(emoji) {
  return emoji.replace(/^:*([^:]+).*$/, '$1');
}

function buy({query, command, args}) {
  const {user_id} = query;

  if (args.length !== 2) {
    return {
      response_type: 'ephemeral',
      text: `*Usage:* ${query.command} ${command} <all|#> <emoji>`,
    };
  }

  if (!isValidSaleCount(args[0])) {
    return {
      response_type: 'ephemeral',
      text: `Error: Expected sale count to be a positive integer or 'all', got: ${args[0]}`,
    };
  }

  if (args[0] === 'all') {
    args[0] = 0;
  }

  let saleCount = parseInt(args[0], 10);
  const emoji = getEmojiName(args[1]);

  return getCurrentPrices({emojis: [emoji]})
    .then((prices) => {
      if (prices.length === 0) {
        return emojiNotFoundResponse(emoji);
      }

      const {price} = prices[0]
      return getPortfolio(user_id)
        .then((portfolio) => {
          let currentlyHeld = 0;
          const currentHolding = portfolio.holdings.find(holding => holding.emoji === emoji);
          if (currentHolding !== undefined) {
            currentlyHeld = currentHolding.count;
          }

          const canAffordCount = Math.floor(portfolio.cash / price);
          let admonition = '';
          if (saleCount === 0) { // special price for 'all'
            admonition = `Buy all: you can afford ${canAffordCount}.\n\n`;
            saleCount = canAffordCount;
          } else if (saleCount > canAffordCount) {
            admonition = `NOTE: You can only afford ${canAffordCount}.\n\n`;
            saleCount = canAffordCount;
          }

          const personalCap = Math.max(0, 1000 - currentlyHeld);
          if (personalCap === 0) {
            return {
              response_type: 'ephemeral',
              text: `You already own too many :${emoji}: *${emoji}*: unit price of $${price.toFixed(2)}.`,
            };
          }
          if (saleCount > personalCap) {
            admonition += `NOTE: Limited to 1,000 shares per person. You have room for ${personalCap} more.`;
            saleCount = personalCap;
          }

          if (saleCount === 0) {
            return {
              response_type: 'ephemeral',
              text: `You can't afford any :${emoji}: *${emoji}*: unit price of $${price.toFixed(2)} exceeds available cash ($${portfolio.cash.toFixed(2)}).`,
            };
          }

          return makeTrade({
            user_id,
            emoji,
            count: saleCount,
            price,
          }).then(() => tradeReceiptResponse({
            admonition,
            emoji,
            count: saleCount,
            price,
            cash: portfolio.cash,
          }));
        });
    });
}

function sell({query, command, args}) {
  const {user_id} = query;

  if (args.length !== 2) {
    return {
      response_type: 'ephemeral',
      text: `*Usage:* ${query.command} ${command} <all|#> <emoji>`,
    };
  }

  if (!isValidSaleCount(args[0])) {
    return {
      response_type: 'ephemeral',
      text: `Error: Expected sale count to be a positive integer or 'all', got: ${args[0]}`,
    };
  }

  if (args[0] === 'all') {
    args[0] = 0;
  }

  let saleCount = parseInt(args[0], 10);
  const emoji = getEmojiName(args[1]);

  return getCurrentPrices({emojis: [emoji]})
    .then((prices) => {
      if (prices.length === 0) {
        return emojiNotFoundResponse(emoji);
      }

      const {price} = prices[0];
      return getPortfolio(user_id)
        .then((portfolio) => {
          const {holdings} = portfolio;
          const holding = holdings.find(holding => holding.emoji === emoji);
          if (holding === undefined) {
            return {
              type: 'ephemeral',
              text: `Can't sell: You don't own any :${emoji}: ${emoji}!`,
            };
          }
          let admonition = '';
          const canSellCount = holding.count;
          if (saleCount === 0) { // special price for 'all'
            admonition = `Sell all: you have ${canSellCount} to sell.\n\n`;
            saleCount = canSellCount;
          } else if (saleCount > canSellCount) {
            admonition = `NOTE: You only have ${canSellCount} to sell.\n\n`;
            saleCount = canSellCount;
          }
          if (saleCount === 0) {
            return {
              response_type: 'ephemeral',
              text: 'You can\'t sell 0!',
            };
          }

          return makeTrade({
            user_id,
            emoji,
            count: -saleCount,
            price,
            book_value: Math.max(holding.book_value / holding.count, 0),
          }).then(() => tradeReceiptResponse({
            admonition,
            emoji,
            count: -saleCount,
            price,
            cash: portfolio.cash,
          }));
        });
    });
}

function rank() {
  return getPortfoliosWithPrices()
    .then((portfoliosByUser) => {
      const portfolios = Object.values(portfoliosByUser);

      portfolios.sort((a, b) => b.net_worth - a.net_worth);

      return context.functions.execute('getUsers', {token: TOKEN})
        .then((usersById) => {
          let rankingsText;
          if (portfolios.length === 0) {
            rankingsText = '<nobody has bought anything yet>';
          } else {
            rankingsText = portfolios.map((p, i) => {
              const user = usersById[p.user];
              p.display_name = (user && user.profile
                && (user.profile.display_name || user.real_name));
              return `${i + 1}. ${renderPortfolioBrief(p)}`;
            }).join('\n');
          }
          return {
            type: 'ephemeral',
            text:
`*Leaderboard:*
${rankingsText}`,
          };
        });
    });
}

function list({args}) {
  return context.functions.execute('getList', {name: args[0]})
    .then((list) => {
      const views = list.prices.map(renderPrice);
      return {
        type: 'ephemeral',
        text:
`*Viewing list:* \`${list.name}\`
${views.join('\n')}`,
      };
    });
}

function price({query, command, args}) {
  if (args.length === 0) {
    return {
      type: 'ephemeral',
      text:
`*Usage*: ${query.command} ${command} <emoji...>`,
    };
  }
  const changeSinceMs = new Date().getTime() - 3 * 24 * 60 * 60 * 1000;
  return context.functions.execute('getPrices', {emojis: args.map(getEmojiName), changeSinceMs})
    .then((prices) => {
      if (prices.length === 0) {
        return {
          type: 'ephemeral',
          text: 'Emoji not found.',
        };
      }
      const views = prices.map(renderPrice).join('\n');
      return {
        type: 'ephemeral',
        text: views,
      };
    });
}

async function react_power({query, command, args}) {
  if (args.length === 0) {
    return {
      type: 'ephemeral',
      text:
`*Usage*: ${query.command} ${command} <emoji...>`,
    };
  }
  const powersByEmoji = await context.functions.execute('getReactPowersByEmoji', {emojis: args.map(getEmojiName)});
  return {
    type: 'ephemeral',
    text: Object.values(powersByEmoji).map(renderReactPower).join('\n'),
  };
}

function usage(command) {
  return {
    response_type: 'ephemeral',
    text:
`*Usage:* ${command} <command> [args...]

*Available commands:*
\`me    \` See your portfolio
\`rank  \` See leaderboard
\`list  \` See emoji lists
\`price \` See emoji price
\`buy   \` Buy emoji
\`sell  \` Sell emoji
\`help  \` See this message
`,
  };
}

exports = function(payload) {
  context.functions.execute('polyfills');

  const slack = context.values.get('slack');
  TOKEN = slack.token;
  SLACK_EMOTRADE_CHANNEL_URL = slack.emotrade_channel_url;

  context.values.get('token');
  const {query} = payload;
  const {text} = query;
  const args = text.split(' ').filter(price => price);
  if ((args.length === 0) || args[0] === 'help') {
    return usage(query.command);
  }

  client = context.services.get('mongodb-atlas');
  db = client.db('emojinomics');

  const command = args.shift();
  switch (command) {
  case 'me': return me({query, command, args});
  case 'rank': return rank({query, command, args});
  case 'list': return list({query, command, args});
  case 'price': return price({query, command, args});
  case 'buy': return buy({query, command, args});
  case 'sell': return sell({query, command, args});
  case 'react-power': return react_power({query, command, args});
  default: return usage(query.command);
  }
  return usage(query.command);
};
