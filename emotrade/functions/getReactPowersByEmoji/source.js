exports = function({emojis, whenMs}) {
  context.functions.execute('polyfills');
  const result = {};
  Object.values(emojis).forEach((emoji) => {
    result[emoji] = 0.1;
  });
  return result;
};
