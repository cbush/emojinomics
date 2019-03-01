function testCalculatePrices() {
  

}

const tests = [
  testCalculatePrices,
];

exports = () => {
  context.functions.execute('polyfills');
  const results = tests.map(test => test.run());
  console.log(results.join('\n'));
  return results;
};
