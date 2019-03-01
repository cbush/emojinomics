const STARTING_CASH = 1000;

function Portfolio(user_id, changeSinceMs) {
  this.user = user_id;
  this.cash = STARTING_CASH;
  this.holdings = [];
  this.trade_count = 0;
  this.shares_traded = 0;
  this.last_transaction = null;

  if (changeSinceMs !== undefined) {
    this.previous_cash = STARTING_CASH;
    this.previous_trade_count = 0;
    this.previous_shares_traded = 0;
    this.previous_last_transaction = null;
  }
}

function ifBeforeTimeAgg(whenMs, agg) {
  return {
    $cond: {
      if: {$lte: ['$timestamp', whenMs]},
      then: agg,
      else: 0,
    },
  };
}

function sumIfBeforeTimeAgg(whenMs, agg) {
  return {
    $sum: ifBeforeTimeAgg(whenMs, agg),
  };
}

exports = function({users, whenMs, changeSinceMs}) {
  if (whenMs === undefined) {
    whenMs = new Date().getTime();
  }
  const client = context.services.get('mongodb-atlas');
  const db = client.db('emojinomics');
  const collection = db.collection('trades');
  const pipeline = [];

  if (users !== undefined) {
    pipeline.push({
      $match: {$expr: {$in: ['$user_id', users]}},
    });
  }

  pipeline.push({
    $match: {
      $expr: {
        $lte: ['$timestamp', Math.max(whenMs, changeSinceMs || whenMs)],
      },
    },
  });

  const $group = {
    _id: {user_id: '$user_id', emoji: '$emoji'},
    count: sumIfBeforeTimeAgg(whenMs, '$count'),
    trade_count: sumIfBeforeTimeAgg(whenMs, 1),
    shares_traded: sumIfBeforeTimeAgg(whenMs, {$abs: '$count'}),
    cash_delta: sumIfBeforeTimeAgg(whenMs, '$cash_delta'),
    book_value: sumIfBeforeTimeAgg(whenMs, '$book_value_delta'),
    fees_paid: sumIfBeforeTimeAgg(whenMs, '$fee_delta'),
    last_transaction: {$max: ifBeforeTimeAgg(whenMs, '$timestamp')},
  };

  const $project = {
    _id: 1,
    count: 1,
    trade_count: 1,
    shares_traded: 1,
    cash_delta: 1,
    last_transaction: 1,
    book_value: 1,
    fees_paid: 1,
    user_id: '$_id.user_id',
    emoji: '$_id.emoji',
  };

  if (changeSinceMs !== undefined) {
    $group.previous_count = sumIfBeforeTimeAgg(changeSinceMs, '$count');
    $group.previous_trade_count = sumIfBeforeTimeAgg(changeSinceMs, 1);
    $group.previous_shares_traded = sumIfBeforeTimeAgg(changeSinceMs, {$abs: '$count'});
    $group.previous_cash_delta = sumIfBeforeTimeAgg(changeSinceMs, '$cash_delta');
    $group.previous_last_transaction = {$max: ifBeforeTimeAgg(changeSinceMs, '$timestamp')};
    $group.previous_book_value = sumIfBeforeTimeAgg(changeSinceMs, '$book_value_delta');
    $group.previous_fees_paid = sumIfBeforeTimeAgg(changeSinceMs, '$fee_delta');
    $project.previous_count = 1;
    $project.previous_trade_count = 1;
    $project.previous_shares_traded = 1;
    $project.previous_cash_delta = 1;
    $project.previous_last_transaction = 1;
    $project.previous_book_value = 1;
    $project.previous_fees_paid = 1;
  }

  pipeline.push({$group});
  pipeline.push({$project});

  return collection
    .aggregate(pipeline)
    .toArray()
    .then(holdings => new Promise((resolve) => {
      const portfoliosByUser = {};
      if (users !== undefined) {
        users.forEach((user_id) => {
          portfoliosByUser[user_id] = new Portfolio(user_id, changeSinceMs);
        });
      }
      holdings.forEach((holding) => {
        const {user_id} = holding;
        let userPortfolio = portfoliosByUser[user_id];
        if (userPortfolio === undefined) {
          userPortfolio = new Portfolio(user_id, changeSinceMs);
          portfoliosByUser[user_id] = userPortfolio;
        }
        userPortfolio.cash += holding.cash_delta;
        userPortfolio.trade_count += holding.trade_count;
        userPortfolio.shares_traded += holding.shares_traded;
        userPortfolio.last_transaction = Math.max(userPortfolio.last_transaction, holding.last_transaction);

        if (changeSinceMs !== undefined) {
          userPortfolio.previous_cash += holding.previous_cash_delta;
          userPortfolio.previous_trade_count += holding.previous_trade_count;
          userPortfolio.previous_shares_traded += holding.previous_shares_traded;
          userPortfolio.previous_last_transaction = Math.max(userPortfolio.previous_last_transaction, holding.previous_last_transaction);
        }

        if (holding.count > 0 || holding.previous_count > 0) {
          userPortfolio.holdings.push(holding);
        }
      });
      resolve(portfoliosByUser);
    }));
};
