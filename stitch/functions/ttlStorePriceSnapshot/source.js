exports = function(arg) {
  return context.functions.execute('ttlScheduleFunction', {
    name: 'storePriceSnapshot',
  });
};
