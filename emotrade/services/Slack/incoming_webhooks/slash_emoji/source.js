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

function renderTradeReceipt(model) {
  return context.functions.execute('slackRender', 'tradeReceipt', model);
}

function getCurrentPrices(args) {
  const now = new Date().getTime();
  args.whenMs = now;
  return context.functions.execute('getPrices', args);
}

function getPortfolio(user_id) {
  return context.functions.execute('getPortfolio', user_id);
}

function getPortfoliosWithPrices({team_id, users}) {
  return context.functions.execute('getPortfoliosWithPrices', {team_id, users});
}

function portfolioResponse(portfolio) {
  return {
    response_type: 'ephemeral',
    text: renderPortfolio(portfolio),
  };
}

function me({query, team_id}) {
  const {user_id} = query;
  return getPortfoliosWithPrices({
    users: [user_id],
    team_id,
  })
    .then(portfoliosByUser => portfolioResponse(portfoliosByUser[user_id]));
}

function tradeReceiptResponse(receipt) {
  return {
    response_type: 'ephemeral',
    text: renderTradeReceipt(receipt),
  };
}

function getEmojiName(emoji) {
  return emoji.replace(/^:*([^:]+).*$/, '$1');
}

function trade({
  query, command, args, team_id, app_id, action, dry_run,
}) {
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
      text: `Error: Expected count to be a positive integer or 'all', got: ${args[0]}`,
    };
  }

  const count = args[0] === 'all' ? 'all' : parseInt(args[0], 10);

  const emoji = getEmojiName(args[1]);

  return context.functions.execute('trade', {
    action,
    app_id,
    team_id,
    user_id,
    emoji,
    count,
    dry_run,
  }).then(tradeReceiptResponse);
}

function buy(args) {
  return trade({
    ...args,
    action: 'buy',
  });
}

function sell(args) {
  return trade({
    ...args,
    action: 'sell',
  });
}

function rank({team_id}) {
  return getPortfoliosWithPrices({team_id})
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

function list({team_id, args}) {
  return context.functions.execute('getList', {team_id, name: args[0]})
    .then((list) => {
      const views = list.prices.map(renderPrice);
      return {
        type: 'ephemeral',
        text:
`*Viewing list:* \`${list.name}\`
${views.join('\n')}`,
      };
    }).catch(error => ({
      type: 'ephemeral',
      text: error.message,
    }));
}

function price({team_id, query, command, args}) {
  if (args.length === 0) {
    return {
      type: 'ephemeral',
      text:
`*Usage*: ${query.command} ${command} <emoji...>`,
    };
  }
  const changeSinceMs = new Date().getTime() - 3 * 24 * 60 * 60 * 1000;
  return context.functions.execute('getPrices', {team_id, emojis: args.map(getEmojiName), changeSinceMs})
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

  const {team_id} = query;

  const command = args.shift();
  const data = {
    query,
    command,
    args,
    team_id,
  };
  switch (command) {
  case 'me': return me(data);
  case 'rank': return rank(data);
  case 'list': return list(data);
  case 'price': return price(data);
  case 'buy': return buy(data);
  case 'sell': return sell(data);
  case 'react-power': return react_power(data);
  default: return usage(query.command);
  }
};
