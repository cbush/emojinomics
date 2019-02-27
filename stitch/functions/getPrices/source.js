exports = function({emojis, whenMs, changeSinceMs, $sort, $limit}) {
  //return context.functions.execute('getPricesSnapshot', {emojis, whenMs, changeSinceMs, $sort, $limit});
  return context.functions.execute('calculatePrices', {emojis, whenMs, changeSinceMs, $sort, $limit});
};
