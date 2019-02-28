exports = function({emojis, whenMs}) {
  context.functions.execute('polyfills');
  const result = {};
  emojis.forEach((emoji) => {
    result[emoji] = {
      emoji,
      value: 0.1,
    };
  });
  return result;
};
